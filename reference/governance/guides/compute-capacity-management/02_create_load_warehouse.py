# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Create the test warehouse
# MAGIC
# MAGIC Creates a 2X-Small serverless warehouse named `capability-guides-capacity-test`. It deletes a stale one with the same name first, so there is never more than one. The id goes to `capacity_test_warehouse`.

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

# COMMAND ----------

create_load_warehouse(args, spark)
