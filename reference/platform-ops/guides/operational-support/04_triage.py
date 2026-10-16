# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Triage failed runs
# MAGIC
# MAGIC Finds failed tasks of jobs tagged `capability_guide_job` through the Jobs API, cross-checks `system.lakeflow.job_run_timeline` for runs the API pass did not return, classifies each error with the spec's patterns, and routes each one through the `on_call` table. The job runs it with `run_if: ALL_DONE`, so it runs even when `fragile_step` fails. Incidents are merged by `incident_id`, so triage reruns do not duplicate them.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_operational_support", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

from support_lib import load_support_spec
spec = load_support_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
catalog, schema = params["catalog"], params["schema"]
from databricks.sdk import WorkspaceClient
from support_lib import INCIDENTS_DDL, classify, failed_tasks, incident_id, match_on_call, now, route_for, run_url
w = WorkspaceClient()
spark.sql(INCIDENTS_DDL.format(table=f"{catalog}.{schema}.support_incidents"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The task

# COMMAND ----------

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

# COMMAND ----------

triage(w, spark, spec, catalog, schema)
