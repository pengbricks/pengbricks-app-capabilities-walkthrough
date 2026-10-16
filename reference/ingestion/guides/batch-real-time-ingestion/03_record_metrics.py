# Databricks notebook source
import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_batch_real_time", ["catalog", "schema", "use_case"])

from databricks.sdk import WorkspaceClient
from capability_framework.workspace import find_job, find_pipeline_id

dbutils.widgets.text("job_run_id", "")
dbutils.widgets.text("pipeline_id", "")
w = WorkspaceClient()
prefix = f"{params['catalog']}.{params['schema']}"
pipeline_id = dbutils.widgets.get("pipeline_id").strip() or find_pipeline_id(w, "capability-guides-ingestion-streaming")
job_run_id = dbutils.widgets.get("job_run_id").strip()
if not job_run_id:
    # Standalone: label the row with the latest run of the guide's job, or "manual".
    job = find_job(w, "capability_guides_batch_real_time")
    latest = next(iter(w.jobs.list_runs(job_id=job.job_id, limit=1)), None) if job else None
    job_run_id = str(latest.run_id) if latest else "manual"
print(f"job_run_id = {job_run_id}, pipeline_id = {pipeline_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Latest pipeline update

# COMMAND ----------

update = next(iter(w.pipelines.list_updates(pipeline_id=pipeline_id, max_results=1).updates or []), None)
print(update.update_id if update else "no update yet", update.state.value if update and update.state else "")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Compute one row of metrics
# MAGIC
# MAGIC Bronze and silver totals, rows dropped by expectations, p50 and p95 latency over the last hour, and the peak events per second.

# COMMAND ----------

metrics = spark.sql(
    f"""
    SELECT
      :run_id AS job_run_id,
      :update_id AS pipeline_update_id,
      :update_state AS pipeline_update_state,
      current_timestamp() AS recorded_at,
      (SELECT count(*) FROM {prefix}.events_bronze) AS bronze_events_total,
      (SELECT count(*) FROM {prefix}.events_silver) AS silver_events_total,
      (SELECT count(*) FROM {prefix}.events_bronze) - (SELECT count(*) FROM {prefix}.events_silver) AS dropped_by_expectations,
      (SELECT percentile_approx(latency_seconds, 0.5) FROM {prefix}.events_silver
         WHERE ingested_at >= current_timestamp() - INTERVAL 1 HOUR) AS p50_latency_seconds,
      (SELECT percentile_approx(latency_seconds, 0.95) FROM {prefix}.events_silver
         WHERE ingested_at >= current_timestamp() - INTERVAL 1 HOUR) AS p95_latency_seconds,
      (SELECT max(events) / 60.0 FROM {prefix}.ingestion_latency_by_minute) AS peak_events_per_second,
      (SELECT count(*) FROM {prefix}.transactions_daily_summary) AS batch_summary_rows
    """,
    args={
        "run_id": job_run_id,
        "update_id": update.update_id if update else "",
        "update_state": str(update.state.value) if update and update.state else "",
    },
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Append to the metrics history
# MAGIC
# MAGIC `ingestion_run_metrics` is a history table: each run adds one row.

# COMMAND ----------

metrics.write.mode("append").option("mergeSchema", "true").saveAsTable(f"{prefix}.ingestion_run_metrics")
display(metrics)
