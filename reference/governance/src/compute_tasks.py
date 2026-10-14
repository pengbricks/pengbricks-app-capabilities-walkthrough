"""Compute and capacity: read warehouse settings, load a small test warehouse, read the queueing back."""

from __future__ import annotations

import concurrent.futures as futures
import time

from common import base_args, run_sql_rows, workspace_id, write_rows
from governance_lib.analysis import max_concurrency, percentile
from governance_lib.sqlgen import qualified

TEST_WAREHOUSE = "capability-guides-capacity-test"
SETTINGS_DDL = ("warehouse_id string, name string, size string, min_clusters int, max_clusters int, auto_stop_minutes int, "
                "warehouse_type string, serverless boolean, channel string, spot_policy string, state string, role string")
LOAD_TAG = "capability_guides_load"


def _settings_row(w, role: str) -> dict:
    return {
        "warehouse_id": w.id, "name": w.name, "size": w.cluster_size, "min_clusters": w.min_num_clusters,
        "max_clusters": w.max_num_clusters, "auto_stop_minutes": w.auto_stop_mins,
        "warehouse_type": w.warehouse_type.value if w.warehouse_type else "",
        "serverless": bool(w.enable_serverless_compute), "channel": w.channel.name.value if w.channel and w.channel.name else "",
        "spot_policy": w.spot_instance_policy.value if w.spot_instance_policy else "",
        "state": w.state.value if w.state else "", "role": role,
    }


def read_settings(args, spark) -> None:
    """Read every warehouse's settings (read only) and create the workspace-scoped views."""
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    rows = [_settings_row(wh, "shared target" if wh.id == args.warehouse_id else "other")
            for wh in w.warehouses.list() if wh.name != TEST_WAREHOUSE]
    write_rows(spark, args.catalog, args.schema, "warehouse_settings", rows, SETTINGS_DDL)
    target = next(r for r in rows if r["warehouse_id"] == args.warehouse_id)
    print("target warehouse settings:", target)

    wid = workspace_id()
    q = lambda name: qualified(args.catalog, args.schema, name)  # noqa: E731
    spark.sql(f"""CREATE OR REPLACE VIEW {q('capacity_query_history')} AS
        SELECT h.statement_id, h.compute.warehouse_id AS warehouse_id, coalesce(s.name, h.compute.warehouse_id) AS warehouse_name,
               h.executed_by, h.execution_status, h.statement_type, h.start_time, h.end_time,
               h.total_duration_ms, h.waiting_for_compute_duration_ms, h.waiting_at_capacity_duration_ms,
               h.execution_duration_ms, h.statement_text
        FROM system.query.history h
        LEFT JOIN {q('warehouse_settings')} s ON s.warehouse_id = h.compute.warehouse_id
        WHERE h.workspace_id = '{wid}' AND h.compute.warehouse_id IS NOT NULL
          AND h.start_time >= current_timestamp() - INTERVAL 14 DAYS""")
    spark.sql(f"""CREATE OR REPLACE VIEW {q('capacity_warehouse_events')} AS
        SELECT e.event_time, e.warehouse_id, coalesce(s.name, e.warehouse_id) AS warehouse_name, e.event_type, e.cluster_count
        FROM system.compute.warehouse_events e
        LEFT JOIN {q('warehouse_settings')} s ON s.warehouse_id = e.warehouse_id
        WHERE e.workspace_id = '{wid}' AND e.event_time >= current_timestamp() - INTERVAL 14 DAYS""")
    print("created views capacity_query_history and capacity_warehouse_events")


def create_load_warehouse(args, spark) -> None:
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.sql import CreateWarehouseRequestWarehouseType

    w = WorkspaceClient()
    for stale in w.warehouses.list():
        if stale.name == TEST_WAREHOUSE:
            w.warehouses.delete(stale.id)
    wh = w.warehouses.create_and_wait(
        name=TEST_WAREHOUSE, cluster_size="2X-Small", min_num_clusters=1, max_num_clusters=1, auto_stop_mins=5,
        enable_serverless_compute=True, warehouse_type=CreateWarehouseRequestWarehouseType.PRO)
    wh = w.warehouses.get(wh.id)
    row = _settings_row(wh, "test warehouse (deleted at end of run)")
    spark.createDataFrame([row], SETTINGS_DDL).write.mode("append").saveAsTable(qualified(args.catalog, args.schema, "warehouse_settings"))
    spark.createDataFrame([(wh.id,)], "warehouse_id string").write.mode("overwrite").saveAsTable(
        qualified(args.catalog, args.schema, "capacity_test_warehouse"))
    print("created", row)


def _test_warehouse_id(args, spark) -> str:
    return run_sql_rows(spark, f"SELECT warehouse_id FROM {qualified(args.catalog, args.schema, 'capacity_test_warehouse')}")[0]["warehouse_id"]


def generate_load(args, spark) -> None:
    """Fire many heavy statements at once so the single-cluster warehouse has to queue."""
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.sql import ExecuteStatementRequestOnWaitTimeout, StatementState

    w = WorkspaceClient()
    warehouse_id = _test_warehouse_id(args, spark)
    count = int(args.queries)
    statement = (
        "/* " + LOAD_TAG + " */ SELECT g, count(*) AS n, sum(len(h)) AS total FROM ("
        "SELECT id % 997 AS g, sha2(cast(id AS STRING), 256) AS h FROM range(0, " + args.range_rows + ")) GROUP BY g"
    )

    def submit(_: int) -> str:
        response = w.statement_execution.execute_statement(
            statement=statement, warehouse_id=warehouse_id, wait_timeout="0s",
            on_wait_timeout=ExecuteStatementRequestOnWaitTimeout.CONTINUE)
        return response.statement_id

    with futures.ThreadPoolExecutor(max_workers=count) as pool:
        ids = list(pool.map(submit, range(count)))
    print(f"submitted {count} concurrent statements")

    deadline = time.time() + 1500
    pending = set(ids)
    final: dict[str, str] = {}
    while pending and time.time() < deadline:
        for statement_id in list(pending):
            state = w.statement_execution.get_statement(statement_id).status.state
            if state in (StatementState.SUCCEEDED, StatementState.FAILED, StatementState.CANCELED, StatementState.CLOSED):
                final[statement_id] = state.value
                pending.discard(statement_id)
        time.sleep(5)
    assert not pending, f"{len(pending)} statements did not finish"
    failed = {s: v for s, v in final.items() if v != "SUCCEEDED"}
    assert not failed, failed
    spark.createDataFrame([(s,) for s in ids], "statement_id string").write.mode("overwrite").saveAsTable(
        qualified(args.catalog, args.schema, "capacity_load_statements"))
    print(f"{len(ids)} statements succeeded")


def analyze_load(args, spark) -> None:
    """Read the load back from system.query.history and system.compute.warehouse_events."""
    q = lambda name: qualified(args.catalog, args.schema, name)  # noqa: E731
    expected = spark.table(q("capacity_load_statements")).count()
    warehouse_id = _test_warehouse_id(args, spark)
    wid = workspace_id()
    query = f"""SELECT h.statement_id, h.start_time, h.end_time, h.total_duration_ms, h.waiting_for_compute_duration_ms,
                       h.waiting_at_capacity_duration_ms, h.execution_duration_ms
                FROM system.query.history h JOIN {q('capacity_load_statements')} s USING (statement_id)
                WHERE h.workspace_id = '{wid}'"""
    rows: list[dict] = []
    deadline = time.time() + 1200
    while time.time() < deadline:
        rows = run_sql_rows(spark, query)
        finished = [r for r in rows if r["end_time"] is not None]
        print(f"system.query.history has {len(finished)} of {expected} load statements")
        if len(finished) >= expected:
            break
        time.sleep(30)
    assert len(rows) >= expected, f"system.query.history returned {len(rows)} of {expected} statements"

    spark.createDataFrame(rows).write.mode("overwrite").saveAsTable(q("capacity_load_queries"))
    waits = [(r["waiting_at_capacity_duration_ms"] or 0) / 1000 for r in rows]
    totals = [(r["total_duration_ms"] or 0) / 1000 for r in rows]
    # Queries run from (end - execution time) to end; queue time sits before that.
    intervals = [(r["end_time"].timestamp() - (r["execution_duration_ms"] or 0) / 1000, r["end_time"].timestamp()) for r in rows]
    waiting_intervals = [(r["start_time"].timestamp(), r["end_time"].timestamp()) for r in rows]
    summary = [{
        "warehouse_id": warehouse_id, "statements": len(rows),
        "queued_statements": sum(1 for w_ in waits if w_ > 0),
        "p50_wait_at_capacity_s": percentile(waits, 50), "p95_wait_at_capacity_s": percentile(waits, 95),
        "max_wait_at_capacity_s": max(waits), "p50_total_s": percentile(totals, 50), "p95_total_s": percentile(totals, 95),
        "peak_running": max_concurrency(intervals), "peak_submitted": max_concurrency(waiting_intervals),
    }]
    write_rows(spark, args.catalog, args.schema, "capacity_load_summary", summary,
               "warehouse_id string, statements long, queued_statements long, p50_wait_at_capacity_s double, "
               "p95_wait_at_capacity_s double, max_wait_at_capacity_s double, p50_total_s double, p95_total_s double, "
               "peak_running long, peak_submitted long")
    print(summary[0])
    assert summary[0]["queued_statements"] > 0, "expected some statements to wait for capacity"

    events = run_sql_rows(spark, f"""SELECT event_time, warehouse_id, event_type, cluster_count
        FROM system.compute.warehouse_events WHERE workspace_id = '{wid}' AND warehouse_id = '{warehouse_id}'
        ORDER BY event_time""")
    spark.createDataFrame(events, "event_time timestamp, warehouse_id string, event_type string, cluster_count int").write.mode(
        "overwrite").saveAsTable(q("capacity_load_events"))
    print("warehouse events for the test warehouse:", [(e["event_type"], e["cluster_count"]) for e in events])


def delete_load_warehouse(args, spark) -> None:
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    removed = 0
    for wh in w.warehouses.list():
        if wh.name == TEST_WAREHOUSE:
            w.warehouses.delete(wh.id)
            removed += 1
    spark.sql(f"UPDATE {qualified(args.catalog, args.schema, 'warehouse_settings')} SET state = 'DELETED' WHERE name = '{TEST_WAREHOUSE}'")
    print(f"deleted {removed} test warehouse(s)")


STEPS = {
    "read_settings": read_settings,
    "create_load_warehouse": create_load_warehouse,
    "generate_load": generate_load,
    "analyze_load": analyze_load,
    "delete_load_warehouse": delete_load_warehouse,
}

if __name__ == "__main__":
    from databricks.sdk.runtime import spark

    arguments = base_args("warehouse-id", "queries", "range-rows")
    STEPS[arguments.step](arguments, spark)
