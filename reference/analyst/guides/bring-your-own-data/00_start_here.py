# Databricks notebook source
# MAGIC %md
# MAGIC # Bring your own data
# MAGIC
# MAGIC This guide shows an analyst uploading a file to a personal folder in a Unity Catalog volume and joining it to a governed table. A full outer join keeps keys that appear on only one side, so unmatched rows stay visible instead of disappearing.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes the governed sample tables from the use-case spec (sample-data generator, fixed seed). |
# MAGIC | `02_simulate_upload` | Writes a CSV to `/Volumes/<catalog>/<schema>/uploads/<user>/`, as an upload from the UI would. |
# MAGIC | `03_join_to_governed` | Full outer joins the upload to `analyst_customers`, saves `byod_joined`, and counts matched, upload-only and governed-only keys. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-byod` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, views and volumes. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the generated data. |
# MAGIC | `run_id` | Set by the job on `03_join_to_governed`. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: every notebook replaces its own tables and files, so the job and each notebook can run again.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_byod"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
