# Databricks notebook source
# MAGIC %md
# MAGIC # AI/BI dashboard visualizations
# MAGIC
# MAGIC This guide deploys one AI/BI dashboard with four pages over the analyst sample orders:
# MAGIC
# MAGIC - **Chart types**: a counter, bar, line, area, combo, pie, heatmap, scatter, histogram, box, funnel, Sankey, pivot, and table.
# MAGIC - **Running totals**: one running total built four ways. The ways are a custom calculation (`AGGREGATE OVER ... CUMULATIVE`), a metric view window measure (`range: cumulative`), a SQL window function in the dataset, and a waterfall chart. A region filter shows which of them follow filters.
# MAGIC - **Metric view**: counters, a ratio, month-over-month growth, and a pivot read straight from the `analyst_viz_metrics` metric view with `MEASURE()`.
# MAGIC - **Custom visualizations**: three Vega-Lite specs (Public Preview). One is a running total computed in Vega-Lite, one is a bullet chart, and one is a dot plot that cross-filters a pivot.
# MAGIC
# MAGIC A final check computes the running total and the trailing three months by hand and compares them with the SQL dataset and the metric view.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes the governed sample tables from the use-case spec (sample-data generator, fixed seed). |
# MAGIC | `02_viz_metric_view.sql` | Creates the `analyst_viz_metrics` metric view with base measures, a ratio, and window measures. A job SQL task on the warehouse runs it. |
# MAGIC | `03_confirm_running_totals` | Checks the dashboard is published, then compares running totals and trailing sums from the SQL dataset, the metric view, and a cumulative sum in Python. |
# MAGIC
# MAGIC ## Required setup
# MAGIC
# MAGIC - A serverless SQL warehouse (the `warehouse_id` variable). The dashboard, the SQL task, and the check all run on it.
# MAGIC - `CREATE TABLE` and `CREATE VIEW` on the guide schema, which the `foundation/` bundle creates.
# MAGIC - Custom visualizations are in Public Preview. If the four tiles on the last page are blank, check that the preview is on for the workspace.
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-aibi-visualizations` (or **Quick run** in the app). To run by hand, open the files in order: Run all in each notebook, and run the SQL file in the SQL editor with the `catalog` and `schema` parameters filled in.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the metric view. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the generated data. |
# MAGIC | `warehouse_id` | SQL warehouse that runs the dashboard and the check queries. |
# MAGIC | `dashboard_id` | ID of the deployed AI/BI visualizations dashboard. |
# MAGIC | `run_id` | Set by the job on `03_confirm_running_totals`. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: the tables, the metric view, and the check table are replaced, and the dashboard is a bundle resource that deploys in place.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_aibi_visualizations"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'warehouse_id', 'dashboard_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
if params.get("dashboard_id"):
    links.append(f'<li>Dashboard: <a href="{host}/dashboardsv3/{params["dashboard_id"]}/published">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
