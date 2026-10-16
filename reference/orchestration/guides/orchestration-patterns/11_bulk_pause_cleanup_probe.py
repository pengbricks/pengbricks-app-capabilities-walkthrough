# Databricks notebook source
# MAGIC %md
# MAGIC # 11. Bulk pause: clean up the probe
# MAGIC
# MAGIC Deletes the probe job. The job runs this task even when an earlier task failed, so the probe never stays behind. Safe to rerun: with no probe, nothing is deleted.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_bulk_pause", ["catalog", "schema", "run_id"], defaults={"run_id": "manual"})
table = f"{params['catalog']}.{params['schema']}.bulk_pause_log"
run_id = params["run_id"]

import bulk_pause as bp
import guide_lib as g
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
spark.sql(f"CREATE TABLE IF NOT EXISTS {table} ({bp.LOG_SCHEMA})")

# COMMAND ----------

bp.delete_probe(w)
print("deleted probe job")
