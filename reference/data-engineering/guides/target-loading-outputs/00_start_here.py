# Databricks notebook source
# MAGIC %md
# MAGIC # Target loading and file outputs
# MAGIC
# MAGIC Safe to rerun: it only lists links to the deployed job and pipeline and writes nothing.
# MAGIC
# MAGIC This guide loads a Delta target with one MERGE that inserts, updates and deletes rows, and records the operation metrics from Delta history. It then writes the merged table to a volume as comma-delimited, pipe-delimited, Excel and JSON files.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_prepare_target` | Creates the target from an initial snapshot and a source batch of inserts, updates and deletes. |
# MAGIC | `02_merge_target` | Runs one MERGE, reads the metrics from Delta history, and checks them against the spec. |
# MAGIC | `03_write_outputs` | Writes the target to the `exports` volume in four formats and records each file in `target_output_files`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability_guides_target_loading` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, pipeline and output volume. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the sample data. |
# MAGIC | `volume` | Volume that receives the files. Defaults to `exports`. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_target_loading"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
