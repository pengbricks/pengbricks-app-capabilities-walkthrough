# Databricks notebook source
import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from capability_framework.workspace import find_job
params = load_params(dbutils, "capability_guides_dataops", ["catalog", "schema", "use_case"])

dbutils.widgets.text("job_id", "")
dbutils.widgets.text("run_id", "")
w = WorkspaceClient()
prefix = f"{params['catalog']}.{params['schema']}"
job_id = dbutils.widgets.get("job_id").strip()
if not job_id:
    job = find_job(w, "capability_guides_dataops")
    if not job:
        raise ValueError("No deployed job is tagged capability_guides_dataops. Deploy the bundle first.")
    job_id = str(job.job_id)
run_id = dbutils.widgets.get("run_id").strip()
if not run_id:
    latest = next(iter(w.jobs.list_runs(job_id=int(job_id), limit=1)), None)
    run_id = str(latest.run_id) if latest else ""
print(f"job_id = {job_id}, run_id = {run_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Task attempts for this run
# MAGIC
# MAGIC Each task's attempt number and result, from the Jobs API. The ingest task shows attempt 0 failed and attempt 1 succeeded. Safe to rerun: this run's rows are deleted and rewritten, and the run history table is overwritten.

# COMMAND ----------

run = w.jobs.get_run(run_id=int(run_id))
attempts = [
    (
        run_id,
        task.task_key,
        task.attempt_number or 0,
        task.state.result_state.value if task.state and task.state.result_state else "RUNNING",
        datetime.fromtimestamp(task.start_time / 1000, timezone.utc) if task.start_time else None,
    )
    for task in run.tasks or []
]
attempts_df = spark.createDataFrame(
    attempts, "job_run_id STRING, task_key STRING, attempt_number INT, result_state STRING, started_at TIMESTAMP"
)
if spark.catalog.tableExists(f"{prefix}.dataops_task_attempts"):
    spark.sql(f"DELETE FROM {prefix}.dataops_task_attempts WHERE job_run_id = '{run_id}'")  # a rerun replaces its own rows
attempts_df.write.mode("append").saveAsTable(f"{prefix}.dataops_task_attempts")
display(spark.sql(f"SELECT * FROM {prefix}.dataops_task_attempts WHERE job_run_id = '{run_id}'"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run history
# MAGIC
# MAGIC The last 25 runs of the job, replaced on each run so the table always matches the Jobs API.

# COMMAND ----------

history = [
    (
        str(item.run_id),
        item.state.result_state.value if item.state and item.state.result_state else "RUNNING",
        item.trigger.value if item.trigger else None,
        datetime.fromtimestamp(item.start_time / 1000, timezone.utc) if item.start_time else None,
        item.run_page_url,
    )
    for item in w.jobs.list_runs(job_id=int(job_id), limit=25)
]
spark.createDataFrame(
    history, "job_run_id STRING, result_state STRING, trigger STRING, started_at TIMESTAMP, run_page_url STRING"
).write.mode("overwrite").saveAsTable(f"{prefix}.dataops_run_history")
display(spark.sql(f"SELECT * FROM {prefix}.dataops_run_history ORDER BY started_at DESC"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Audit trail
# MAGIC
# MAGIC Recent `audit_log` rows, and the silver table's Delta history, which is what the rollback job restores from.

# COMMAND ----------

display(spark.sql(f"SELECT feed, status, rows_read, rows_valid, started_at FROM {prefix}.audit_log ORDER BY started_at DESC LIMIT 10"))
display(spark.sql(f"DESCRIBE HISTORY {prefix}.transactions_silver").select("version", "timestamp", "operation").limit(10))
