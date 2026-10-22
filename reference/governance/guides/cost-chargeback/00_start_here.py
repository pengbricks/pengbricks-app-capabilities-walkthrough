# Databricks notebook source
# MAGIC %md
# MAGIC # Cost tracking and chargeback
# MAGIC
# MAGIC This guide breaks down list-price spend from system tables by product, tag, user and job, checks a 7-day budget, forecasts 30 days with `ai_forecast`, and flags optimization candidates.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_build_views` | Builds the enriched usage view from `system.billing.usage` and list prices. |
# MAGIC | `02_spend_breakdown` | Writes the breakdown tables. |
# MAGIC | `03_budget_check` | Records the 7-day spend against the threshold. |
# MAGIC | `04_forecast.sql` | SQL task: forecasts 30 days with `ai_forecast`. It runs on the SQL warehouse because `ai_forecast` is not available on serverless job compute in this workspace. |
# MAGIC | `05_check_forecast` | Reads the forecast back and asserts 30 days. |
# MAGIC | `06_optimization` | Flags idle or costly warehouses and jobs. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-cost` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Run `04_forecast.sql` in the SQL editor with `catalog` and `schema` set, or skip it and let `05` read the last job run's forecast.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for this guide's tables. |
# MAGIC | `budget_threshold_usd` | Alert when 7-day list-price spend is above this amount. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# MAGIC
# MAGIC Safe to rerun: it only reads the deployed job and links to it.
# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_cost"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'budget_threshold_usd'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
