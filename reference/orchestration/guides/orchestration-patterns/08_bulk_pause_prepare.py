# Databricks notebook source
# MAGIC %md
# MAGIC # 8. Bulk pause: prepare
# MAGIC
# MAGIC Creates a small scheduled probe job, so there is at least one unpaused schedule to pause, and records the "before" state of every job tagged `capability_guide_job` that has a schedule. The probe job is replaced on each run, never duplicated. Every state goes to `bulk_pause_log`.

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

bp.ensure_probe(w)
bp.log(spark, table, run_id, "before", bp.tagged_scheduled_jobs(w))
