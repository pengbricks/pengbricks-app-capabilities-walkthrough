# Databricks notebook source
# MAGIC %md
# MAGIC # No-code data preparation
# MAGIC
# MAGIC This guide pairs a Lakeflow Designer flow with its SQL equivalent. The flow filters, joins, renames and derives columns in the UI. The SQL builds the same `prep_flow_output` table, so you can compare the flow's output with a known-good result.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes the governed sample tables from the use-case spec (dbldatagen, fixed seed). |
# MAGIC | `02_build_flow_output` | Builds `prep_flow_output` and `prep_flow_summary` with SQL: the same steps the Designer flow performs. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-no-code-prep` (or **Quick run** in the app). To run by hand, open the two notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, views and volumes. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the generated data. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_no_code_prep"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
