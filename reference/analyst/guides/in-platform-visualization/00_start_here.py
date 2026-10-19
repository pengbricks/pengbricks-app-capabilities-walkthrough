# Databricks notebook source
# MAGIC %md
# MAGIC # In-platform visualization
# MAGIC
# MAGIC This guide draws the same revenue numbers three ways: governed views, matplotlib charts in a notebook saved to a volume, and an AI/BI dashboard on the same views. A final check runs the dashboard's own queries and confirms its totals equal the views and the charts.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes the governed sample tables from the use-case spec (sample-data generator, fixed seed). |
# MAGIC | `02_create_views` | Creates the two governed views that the charts and the dashboard both read. |
# MAGIC | `03_notebook_charts` | Draws two matplotlib charts from the views, saves them to the `charts` volume, and records the plotted totals. |
# MAGIC | `04_confirm_totals` | Runs the published dashboard's dataset queries and compares their totals with the views and the charts. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-visualization` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, views and volumes. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the generated data. |
# MAGIC | `warehouse_id` | SQL warehouse that runs the dashboard queries. |
# MAGIC | `dashboard_id` | ID of the deployed revenue overview dashboard. |
# MAGIC | `run_id` | Set by the job on `04_confirm_totals`. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_visualization"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'warehouse_id', 'dashboard_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
