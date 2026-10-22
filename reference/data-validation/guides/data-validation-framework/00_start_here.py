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

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC - **A Lakebase project** named by `lakebase_project` (default `capability-guides`). `01_create_source` stops with an error if it is missing; before the check it crashed with a SIGABRT and then `NotFound`. The new project brings the `production` branch, the `primary` endpoint, and the `databricks_postgres` database the spec expects. Create it with scale to zero (five idle minutes):
# MAGIC   ```bash
# MAGIC   databricks postgres create-project capability-guides --json '{"spec": {"display_name": "Capability guides", "pg_version": 17, "default_endpoint_settings": {"autoscaling_limit_min_cu": 0.5, "autoscaling_limit_max_cu": 2, "suspend_timeout_duration": "300s"}}}'
# MAGIC   ```
# MAGIC   To use a project you already have, set `lakebase_project` to its ID (`--var lakebase_project=<project-id>` at deploy, or the widget) and make sure it has a `production` branch, a `primary` endpoint, and a `databricks_postgres` database. You need access to it as yourself, because the notebooks connect as your user.
# MAGIC - **A privilege for `02_setup_federation`.** It creates the Unity Catalog connection `capability_guides_dv_source` (type POSTGRESQL). The running user needs `CREATE CONNECTION` on the metastore: `GRANT CREATE CONNECTION ON METASTORE TO <principal>;`
# MAGIC - **The pipeline must have run before `05_read_expectation_metrics`.** `03_load_target` must run first too. The job does both. By hand, deploy the bundle and run the pipeline: `databricks bundle run capability_guides_data_validation_pipeline --target dev --var catalog=<catalog> --var warehouse_id=<warehouse-id> --var app_service_principal=<app-service-principal-application-id>`. `05` and later also stop with a message if their inputs are missing.
# MAGIC - **A SQL warehouse** for the paused alert (`warehouse_id` at deploy). Serverless works.

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
