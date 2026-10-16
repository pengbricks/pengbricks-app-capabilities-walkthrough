# Databricks notebook source
# MAGIC %md
# MAGIC # 10. Bulk pause: resume all
# MAGIC
# MAGIC Restores only the jobs this run paused. Jobs that were already paused before the maintenance window stay paused. Use the same `run_id` as the pause notebook: the `paused_by_run` rows link the two.

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

changed = {
    row.job_id
    for row in spark.sql(
        f"SELECT job_id FROM {table} WHERE job_run_id = '{run_id}' AND phase = 'paused_by_run'"
    ).collect()
}
for job in bp.tagged_scheduled_jobs(w):
    if job["job_id"] in changed:
        bp.set_status(w, job, "UNPAUSED")
bp.log(spark, table, run_id, "after_resume", bp.tagged_scheduled_jobs(w))
