# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_batch_real_time", ["catalog", "schema", "use_case"])

import time
from databricks.sdk import WorkspaceClient
from capability_framework.workspace import find_pipeline_id

dbutils.widgets.text("run_pipeline", "true")
dbutils.widgets.text("pipeline_id", "")
run_pipeline = dbutils.widgets.get("run_pipeline").strip().lower() == "true"
w = WorkspaceClient()
pipeline_id = dbutils.widgets.get("pipeline_id").strip() or find_pipeline_id(w, "capability-guides-ingestion-streaming")
if not pipeline_id:
    raise ValueError("No pipeline named capability-guides-ingestion-streaming is deployed. Deploy the bundle first.")
prefix = f"{params['catalog']}.{params['schema']}"
print(f"pipeline_id = {pipeline_id}, run_pipeline = {run_pipeline}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start an update and wait for it
# MAGIC
# MAGIC Standalone, this notebook runs the pipeline. In the job, the `streaming_pipeline` task has already run the update, so `run_pipeline` is `false` and this step is skipped. Safe to rerun: an update with no new files adds no rows, and the other cells only read.

# COMMAND ----------

if run_pipeline:
    update_id = w.pipelines.start_update(pipeline_id=pipeline_id).update_id
    while True:
        state = w.pipelines.get_update(pipeline_id=pipeline_id, update_id=update_id).update.state.value
        print(f"update {update_id}: {state}")
        if state in ("COMPLETED", "FAILED", "CANCELED"):
            break
        time.sleep(20)
    if state != "COMPLETED":
        raise RuntimeError(f"Pipeline update {update_id} ended as {state}")
else:
    print("Pipeline update already ran as the previous job task; inspecting its output")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Rows in each dataset
# MAGIC
# MAGIC Bronze holds every landed event. Silver holds the events that passed the expectations.

# COMMAND ----------

counts = spark.sql(
    f"""
    SELECT 'events_bronze' AS dataset, count(*) AS rows FROM {prefix}.events_bronze
    UNION ALL SELECT 'events_silver', count(*) FROM {prefix}.events_silver
    UNION ALL SELECT 'ingestion_latency_by_minute', count(*) FROM {prefix}.ingestion_latency_by_minute
    UNION ALL SELECT 'transactions_daily_summary', count(*) FROM {prefix}.transactions_daily_summary
    """
)
display(counts)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Latency and throughput per minute

# COMMAND ----------

display(spark.sql(f"SELECT * FROM {prefix}.ingestion_latency_by_minute ORDER BY ingested_minute DESC LIMIT 20"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Expectation results from the latest update
# MAGIC
# MAGIC The pipeline event log records, for each expectation, how many rows passed and failed.

# COMMAND ----------

expectations = spark.sql(
    f"""
    WITH latest AS (
      SELECT origin.update_id AS update_id FROM event_log('{pipeline_id}')
      WHERE event_type = 'create_update' ORDER BY timestamp DESC LIMIT 1
    ),
    progress AS (
      SELECT explode(from_json(
               details:flow_progress.data_quality.expectations,
               'array<struct<name:string,dataset:string,passed_records:bigint,failed_records:bigint>>')) AS e
      FROM event_log('{pipeline_id}'), latest
      WHERE event_type = 'flow_progress' AND origin.update_id = latest.update_id
        AND details:flow_progress.data_quality.expectations IS NOT NULL
    )
    SELECT e.dataset, e.name AS expectation, sum(e.passed_records) AS passed, sum(e.failed_records) AS failed
    FROM progress GROUP BY ALL ORDER BY 1, 2
    """
)
display(expectations)
