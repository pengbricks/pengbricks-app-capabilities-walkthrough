# Databricks notebook source
# MAGIC %md
# MAGIC # SCD change capture
# MAGIC
# MAGIC This guide builds slowly changing dimensions from one change feed with AUTO CDC in a Lakeflow Declarative Pipeline. Type 1 keeps one current row per key. Type 2 keeps every version with start and end timestamps. The run applies an initial snapshot, then a batch of inserts, updates and deletes, and records counts before and after.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_prepare_initial` | Writes the initial snapshot to `accounts_changes` as change_seq 1, all INSERT. |
# MAGIC | `02_run_pipeline_initial` | Runs the pipeline with a full refresh (standalone) or inspects its output (in the job). |
# MAGIC | `03_counts_before` | Records current rows, history rows and deleted keys for SCD type 1 and type 2, and checks them against the spec. |
# MAGIC | `04_prepare_changes` | Adds the change batch (change_seq 2: inserts, updates, deletes). Deletes its own earlier rows first, so a rerun cannot add the batch twice. |
# MAGIC | `05_run_pipeline_changes` | Runs an incremental update (standalone) or inspects its output (in the job). |
# MAGIC | `06_counts_after` | Records the counts again and checks that updates made history and deletes closed versions. |
# MAGIC | `pipeline/` | The pipeline source: `accounts_scd.sql` with the AUTO CDC flows for type 1 and type 2. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability_guides_scd` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. The `run_pipeline` notebooks start the pipeline for you.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, pipeline and output volume. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the sample data. |
# MAGIC | `run_pipeline` | `true` starts a pipeline update and waits for it. The job sets it to `false` because its pipeline task already ran. Defaults to `true` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_scd"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

pipelines = [p for p in w.pipelines.list_pipelines() if "capability-guides-scd" in (p.name or "")]
for p in pipelines:
    links.append(f'<li>Pipeline <b>{p.name}</b>: <a href="{host}/pipelines/{p.pipeline_id}">open</a></li>')
displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
