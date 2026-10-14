"""Tasks of the operational support job: on_call table, a retried idempotent write, a failure by design, and triage."""

from __future__ import annotations

import argparse

from databricks.sdk import WorkspaceClient
from support_lib import (
    INCIDENTS_DDL,
    ON_CALL_COLUMNS,
    classify,
    failed_tasks,
    incident_id,
    load_support_spec,
    match_on_call,
    now,
    route_for,
    run_url,
)


class TransientSourceError(RuntimeError):
    pass


def setup_on_call(spark, spec, catalog, schema, **_):
    """Overwrite on_call from the spec, so the table always matches the committed ownership map."""
    cols = ["tag_key", "tag_value", "owner_team", "owner_contact", "escalation_contact", "escalate_after_minutes"]
    rows = [tuple(r[c] for c in cols) for r in spec["on_call"]]
    spark.createDataFrame(rows, ON_CALL_COLUMNS).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{catalog}.{schema}.on_call")
    spark.sql(f"COMMENT ON TABLE {catalog}.{schema}.on_call IS 'Maps job tags to owner and escalation contacts; read by the triage task'")
    spark.sql(INCIDENTS_DDL.format(table=f"{catalog}.{schema}.support_incidents"))
    print(f"on_call: {len(rows)} rows")


def write_with_retry(spark, spec, catalog, schema, execution_count, **_):
    """Fail the first execution, succeed on the retry. The MERGE is keyed by item id, so reruns never duplicate rows."""
    if execution_count <= 1:
        raise TransientSourceError("Simulated transient upstream outage on first execution; the task retry policy will rerun")
    import dbldatagen as dg

    cfg = spec["work_items"]
    spec_df = (
        dg.DataGenerator(spark, name="work_items", rows=cfg["count"], partitions=1, randomSeedMethod="hash_fieldname", randomSeed=cfg["seed"])
        .withIdOutput()
        .withColumn("queue", "string", values=["ingest", "reporting", "access"], random=True)
        .withColumn("priority", "string", values=["p1", "p2", "p3"], weights=[1, 3, 6], random=True)
        .withColumn("payload_kb", "int", minValue=1, maxValue=512, random=True)
        .build()
    )
    spec_df.createOrReplaceTempView("_work_items")
    table = f"{catalog}.{schema}.support_work_items"
    spark.sql(f"CREATE TABLE IF NOT EXISTS {table} (id BIGINT, queue STRING, priority STRING, payload_kb INT, written_at TIMESTAMP)")
    spark.sql(
        f"""MERGE INTO {table} t USING (SELECT *, current_timestamp() AS written_at FROM _work_items) s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET t.queue = s.queue, t.priority = s.priority, t.payload_kb = s.payload_kb
            WHEN NOT MATCHED THEN INSERT *"""
    )
    n = spark.table(table).count()
    print(f"execution {execution_count}: merged {cfg['count']} work items; table holds {n} rows")


def fragile_step(repair_count, **_):
    """Fails until the run is repaired. {{job.repair_count}} is 0 on the original run and 1 after the first repair."""
    if repair_count == 0:
        raise TransientSourceError("TransientSourceError: upstream dependency unavailable on first attempt (by design). Repair the run to retry this task.")
    print(f"repair_count={repair_count}: dependency available, step complete")


def triage(w, spark, spec, catalog, schema, **_):
    """Find failed guide runs through the Jobs API and system tables, classify errors, route each to an owner."""
    import time

    tag_key = spec["triage_job_tag"]
    cutoff = int((time.time() - spec["lookback_hours"] * 3600) * 1000)
    on_call = [r.asDict() for r in spark.table(f"{catalog}.{schema}.on_call").collect()]
    host = w.config.host
    found: list[dict] = []
    api_run_ids: set[int] = set()
    for job in w.jobs.list():
        tags = (job.settings.tags or {}) if job.settings else {}
        if tag_key not in tags:
            continue
        for run in w.jobs.list_runs(job_id=job.job_id, start_time_from=cutoff, expand_tasks=True):
            tasks = [
                {"task_key": t.task_key, "attempt_number": t.attempt_number or 0, "task_run_id": t.run_id, "result_state": t.state.result_state.value if t.state and t.state.result_state else None}
                for t in (run.tasks or [])
            ]
            for t in failed_tasks({"tasks": tasks}):
                try:
                    out = w.jobs.get_run_output(t["task_run_id"])
                    msg = out.error or (out.error_trace or "")[-600:]
                except Exception as e:  # noqa: BLE001
                    msg = f"output unavailable: {e}"
                found.append(_incident(host, "jobs_api", job, tags, run.run_id, t["task_key"], msg, spec, on_call))
                api_run_ids.add(run.run_id)

    # Cross-check with system tables: failed guide runs the Jobs API pass did not return.
    sys_rows = 0
    try:
        q = f"""
        WITH latest AS (
          SELECT job_id, name, tags FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY workspace_id, job_id ORDER BY change_time DESC) rn
            FROM system.lakeflow.jobs WHERE delete_time IS NULL) WHERE rn = 1)
        SELECT t.job_id, t.run_id, t.result_state, t.termination_code, l.tags
        FROM system.lakeflow.job_run_timeline t JOIN latest l ON t.job_id = l.job_id
        WHERE t.period_start_time >= current_timestamp() - INTERVAL {int(spec['lookback_hours'])} HOURS
          AND t.result_state IN ('FAILED', 'ERROR', 'TIMED_OUT') AND l.tags['{tag_key}'] IS NOT NULL
        """
        for r in spark.sql(q).collect():
            sys_rows += 1
            if int(r["run_id"]) in api_run_ids:
                continue
            fake_job = type("J", (), {"job_id": int(r["job_id"])})
            found.append(_incident(host, "system_table", fake_job, dict(r["tags"]), int(r["run_id"]), "(job)", f"{r['result_state']} {r['termination_code']}", spec, on_call))
    except Exception as e:  # noqa: BLE001
        print(f"system.lakeflow cross-check unavailable: {str(e)[:200]}")

    found = list({i["incident_id"]: i for i in found}.values())  # one row per run/task/source
    if found:
        cols = "incident_id string, detected_at timestamp, source string, job_key string, job_id bigint, run_id bigint, task_key string, run_url string, error_class string, severity string, error_message string, owner_team string, owner_contact string, escalation_contact string, route string, status string"
        spark.createDataFrame([tuple(i[c.split()[0]] for c in cols.split(", ")) for i in found], cols).createOrReplaceTempView("_found")
        spark.sql(
            f"""MERGE INTO {catalog}.{schema}.support_incidents t USING _found s ON t.incident_id = s.incident_id
                WHEN MATCHED AND t.status = 'open' THEN UPDATE SET t.error_class = s.error_class, t.severity = s.severity, t.owner_team = s.owner_team,
                  t.owner_contact = s.owner_contact, t.escalation_contact = s.escalation_contact, t.route = s.route
                WHEN NOT MATCHED THEN INSERT (incident_id, detected_at, source, job_key, job_id, run_id, task_key, run_url, error_class, severity,
                  error_message, owner_team, owner_contact, escalation_contact, route, status)
                VALUES (s.incident_id, s.detected_at, s.source, s.job_key, s.job_id, s.run_id, s.task_key, s.run_url, s.error_class, s.severity,
                  s.error_message, s.owner_team, s.owner_contact, s.escalation_contact, s.route, s.status)"""
        )
    by_class: dict[str, int] = {}
    for i in found:
        by_class[i["error_class"]] = by_class.get(i["error_class"], 0) + 1
    print(f"triage: {len(found)} failed task or run incidents ({len(api_run_ids)} runs via Jobs API, {sys_rows} failed runs in system tables)")
    print(f"by class: {by_class}")
    for i in found[:15]:
        print(f"  {i['incident_id']} [{i['error_class']}/{i['severity']}] -> {i['route']}")


def _incident(host, source, job, tags, run_id, task_key, message, spec, on_call):
    cls, severity = classify(message, spec["error_classes"], spec["default_error_class"])
    oc = match_on_call(tags, on_call)
    return {
        "incident_id": incident_id(run_id, task_key, source),
        "detected_at": now(),
        "source": source,
        "job_key": tags.get(spec["triage_job_tag"]),
        "job_id": job.job_id,
        "run_id": run_id,
        "task_key": task_key,
        "run_url": run_url(host, job.job_id, run_id),
        "error_class": cls,
        "severity": severity,
        "error_message": (message or "")[:1500],
        "owner_team": oc["owner_team"],
        "owner_contact": oc["owner_contact"],
        "escalation_contact": oc["escalation_contact"],
        "route": route_for(severity, oc),
        "status": "open",
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--task", required=True)
    p.add_argument("--catalog", required=True)
    p.add_argument("--schema", required=True)
    p.add_argument("--use-case-file", required=True)
    p.add_argument("--repair-count", type=int, default=0)
    p.add_argument("--execution-count", type=int, default=1)
    a = p.parse_args()
    from databricks.sdk.runtime import spark

    spec = load_support_spec(a.use_case_file)
    ctx = dict(spark=spark, spec=spec, catalog=a.catalog, schema=a.schema, repair_count=a.repair_count, execution_count=a.execution_count)
    if a.task == "triage":
        ctx["w"] = WorkspaceClient()
    {"setup_on_call": setup_on_call, "write_with_retry": write_with_retry, "fragile_step": fragile_step, "triage": triage}[a.task](**ctx)


if __name__ == "__main__":
    main()
