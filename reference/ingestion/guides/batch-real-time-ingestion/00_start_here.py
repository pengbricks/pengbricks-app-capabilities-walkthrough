# Databricks notebook source
# MAGIC %md
# MAGIC # Batch and real-time ingestion
# MAGIC
# MAGIC One job runs both paths. The batch path is the configuration-driven framework writing `transactions_silver`. The real-time path is a serverless Lakeflow Declarative Pipeline: Auto Loader picks up new event files, expectations validate them, and a materialized view tracks latency and throughput per minute.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `(job task) batch_ingest` | Runs the *Ingestion framework job*, which fills `transactions_silver`. In a notebook session, run that guide's notebooks or job first. |
# MAGIC | `01_land_stream_events` | Lands the streaming sample batches under fixed file names and skips batches that already exist. |
# MAGIC | `pipeline/` | Pipeline source, not notebooks: `events_bronze` (Auto Loader), `events_silver` (expectations), `ingestion_latency_by_minute`, and `transactions_daily_summary`. |
# MAGIC | `02_run_pipeline` | Starts a pipeline update and waits for it when run on its own. In the job, the pipeline task runs the update and this notebook only inspects the output tables and expectation results. |
# MAGIC | `03_record_metrics` | Appends one row of latency, throughput, and update metrics to `ingestion_run_metrics`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the **Batch and real-time job** (or **Quick run** in the app). To work step by step, make sure `transactions_silver` exists (run the *Configuration-driven ingestion* job once), then open `01_land_stream_events`, `02_run_pipeline`, and `03_record_metrics` in order and press Run all in each. Standalone, `02_run_pipeline` starts the pipeline update itself. Blank widgets take the deployed job's defaults.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for this guide's tables and the `landing` volume. |
# MAGIC | `use_case` | Use-case spec under `use_cases/`; its `streaming` block sets the event batches. |

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
from capability_framework.workspace import guide_links_html

params = load_params(dbutils, "capability_guides_batch_real_time", ["catalog", "schema", "use_case"])

w = WorkspaceClient()
displayHTML(guide_links_html(w, ["capability_guides_batch_real_time"], ["capability-guides-ingestion-streaming"]))
