# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Analyze the queueing
# MAGIC
# MAGIC Reads the load back from `system.query.history` and `system.compute.warehouse_events` and summarizes wait times and peak concurrency. System tables can lag the statements, so the notebook polls for up to 20 minutes.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_compute_capacity", ['catalog', 'schema', 'warehouse_id', 'queries', 'range_rows'])

# COMMAND ----------

import datetime as dt
from types import SimpleNamespace
from common import run_sql_rows, workspace_id, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import grant_sql, principal_kind, qualified
import concurrent.futures as futures
import time
from governance_lib.analysis import max_concurrency, percentile

args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    warehouse_id=params["warehouse_id"],
    queries=params["queries"],
    range_rows=params["range_rows"],
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

TEST_WAREHOUSE = "capability-guides-capacity-test"

SETTINGS_DDL = ("warehouse_id string, name string, size string, min_clusters int, max_clusters int, auto_stop_minutes int, "
                "warehouse_type string, serverless boolean, channel string, spot_policy string, state string, role string")

LOAD_TAG = "capability_guides_load"

def _test_warehouse_id(args, spark) -> str:
    return run_sql_rows(spark, f"SELECT warehouse_id FROM {qualified(args.catalog, args.schema, 'capacity_test_warehouse')}")[0]["warehouse_id"]

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

# COMMAND ----------

analyze_load(args, spark)
