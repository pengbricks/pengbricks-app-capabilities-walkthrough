# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Read warehouse settings
# MAGIC
# MAGIC Reads every warehouse's settings (read only) into `warehouse_settings` and creates two workspace-scoped views over `system.query.history` and `system.compute.warehouse_events`.

# MAGIC
# MAGIC Safe to rerun: `warehouse_settings` is replaced and the views use `CREATE OR REPLACE`. It changes no warehouse.
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

# COMMAND ----------

read_settings(args, spark)
