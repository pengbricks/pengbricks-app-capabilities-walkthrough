# Databricks notebook source
# MAGIC %md
# MAGIC # 9. Bulk pause: pause all
# MAGIC
# MAGIC Safe to rerun: jobs that are already paused are left alone, and this run's log rows are replaced.
# MAGIC
# MAGIC Sets every unpaused schedule to PAUSED in one pass and records exactly which jobs this run changed (`paused_by_run`), so the next notebook restores only those.

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

jobs = bp.tagged_scheduled_jobs(w)
to_pause = g.plan_pause_change(jobs, "PAUSED")
# Remember exactly which jobs this run will change before changing any, so resume restores only those,
# even if this task fails part way.
bp.log(spark, table, run_id, "paused_by_run", [{**j, "schedule_status": "UNPAUSED"} for j in to_pause])
for job in to_pause:
    bp.set_status(w, job, "PAUSED")
bp.log(spark, table, run_id, "after_pause", bp.tagged_scheduled_jobs(w))
