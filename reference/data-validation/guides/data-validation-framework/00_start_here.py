# Databricks notebook source
# MAGIC %md
# MAGIC # Data validation framework
# MAGIC
# MAGIC Safe to rerun: it only lists links to the deployed job and pipeline and writes nothing.
# MAGIC
# MAGIC This guide copies a source database into Databricks, enforces rules in a pipeline with a quarantine table, and runs every other check from one spec into one results table. It then reads lineage to show what a failed check affects and publishes a metric view for one metric.
# MAGIC
# MAGIC The source is a stand-in: a schema in Lakebase Postgres, read through a Unity Catalog connection and `remote_query`. It plays the part of an ERP or order database such as SQL Server. The validation logic lives only in Databricks.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_create_source` | Creates `orders` and `customers` in the Postgres source with a few deliberately bad rows. |
# MAGIC | `02_setup_federation` | Creates or refreshes the Unity Catalog connection to the source. |
# MAGIC | `03_load_target` | Copies both tables with `remote_query`, then changes the source so six orders move to the previous day. |
# MAGIC | `04_snapshot_source` | Captures the per-day source aggregates that the snapshot checks compare against. |
# MAGIC | `pipeline/dv_orders.py` | The pipeline: silver with warn, drop, and fail expectations, and a quarantine table. |
# MAGIC | `05_read_expectation_metrics` | Reads pass and fail counts per expectation from the pipeline event log. |
# MAGIC | `06_run_validations` | Runs every check in the spec and writes `dv_check_results`. Stops the job when a blocking check fails. |
# MAGIC | `07_publish_metric_view` | Creates the `dv_orders_metrics` metric view and checks it against the table. |
# MAGIC | `08_read_lineage` | Reads `system.access.table_lineage` to list what each dataset feeds. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-data-validation` (or **Quick run** in the app). Lineage reaches the system tables several minutes after the writes, so the last task polls and can take 10 to 25 minutes. To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, the pipeline, and the metric view. |
# MAGIC | `use_case` | Spec under `use_cases/` with the source data, rules, checks, and metric view. |
# MAGIC | `lakebase_project` | Lakebase Postgres project that hosts the stand-in source. Overrides the spec. |
# MAGIC | `warehouse_id` | SQL warehouse for the paused failure alert. |
# MAGIC | `block_on` | `error` (default) stops the job on a failed error-severity check, `warn` stops on any failure, `none` never stops. |
# MAGIC | `run_id` | Set by the job. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_data_validation"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
