# Databricks notebook source
# MAGIC %md
# MAGIC # Local tool connectivity
# MAGIC
# MAGIC This guide proves the path a desktop tool takes: the Databricks SQL connector, authenticated with OAuth, running a query against a SQL warehouse. The connection example in the job is the same code you would run from a laptop. The `examples/` folder holds the same connection for Python, R, ODBC, JDBC, Databricks Connect and SAS or SPSS.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes the governed sample tables from the use-case spec (sample-data generator, fixed seed). |
# MAGIC | `02_sql_connector_check` | Connects with the SQL connector over OAuth, queries `analyst_customers`, and records the result in `connectivity_check`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-local-connectivity` (or **Quick run** in the app). To run by hand, open the two notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, views and volumes. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the generated data. |
# MAGIC | `warehouse_id` | SQL warehouse the connector connects to. |
# MAGIC | `run_id` | Set by the job. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: tables are replaced, so the job and each notebook can run again.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_local_connectivity"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'warehouse_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
