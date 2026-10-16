# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Delete the test warehouse
# MAGIC
# MAGIC Deletes the test warehouse. The job runs this step with `run_if: ALL_DONE`, so the warehouse is removed even when an earlier step fails.

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

# COMMAND ----------

delete_load_warehouse(args, spark)
