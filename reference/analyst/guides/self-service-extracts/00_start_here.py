# Databricks notebook source
# MAGIC %md
# MAGIC # Self-service extracts
# MAGIC
# MAGIC This guide gives an analyst two ways to hand data to someone else. A job writes a filtered extract as a formatted Excel workbook and a pipe-delimited file in a volume. A published AI/BI dashboard on the same filter is scheduled weekly and sent to a subscriber.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes the governed sample tables from the use-case spec (sample-data generator, fixed seed). |
# MAGIC | `02_build_extracts` | Filters orders, writes `extract_orders`, an Excel workbook and a pipe-delimited file, and checks all three agree on the row count. |
# MAGIC | `03_schedule_dashboard` | Schedules the dashboard and subscribes the notification address. Reuses the schedule and subscription if they exist. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-extracts` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, views and volumes. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the generated data. |
# MAGIC | `warehouse_id` | SQL warehouse that refreshes the scheduled dashboard. |
# MAGIC | `notification_email` | Workspace user who subscribes to the schedule. |
# MAGIC | `dashboard_id` | ID of the deployed partner orders dashboard. |
# MAGIC | `run_id` | Set by the job. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_extracts"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'warehouse_id', 'notification_email', 'dashboard_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
