# Databricks notebook source
# MAGIC %md
# MAGIC # File format ingestion
# MAGIC
# MAGIC This guide generates one sample file per format (CSV, pipe-delimited, Excel, nested JSON, XML) in a Unity Catalog volume, ingests them with a Lakeflow Declarative Pipeline and Auto Loader, and checks row counts, rescued data and column types for each format. Safe to rerun: the landing folder is cleared and rewritten, the pipeline does a full refresh, and only `format_ingestion_checks` grows, by one set of rows per run.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_files` | Builds each file locally from the use-case spec and copies it to `source_landing/formats`. |
# MAGIC | `02_run_pipeline` | Starts a full-refresh pipeline update (by hand) or inspects the job's update, and shows the output tables. |
# MAGIC | `03_verify_tables` | Runs the 24 format checks, writes them to `format_ingestion_checks`, and fails on any mismatch. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-file-formats` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. `02_run_pipeline` starts the pipeline itself when run by hand.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the `source_landing` volume. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the data, sources and checks. |
# MAGIC | `run_pipeline` | `true` starts a pipeline update and waits for it. The job sets it to `false` because its pipeline task already ran. Defaults to `true` when run by hand. |
# MAGIC | `run_id` | Set by the job on the notebooks that log results. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_file_formats"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

pipelines = [p for p in w.pipelines.list_pipelines() if "capability-guides-file-formats" in (p.name or "")]
for p in pipelines:
    links.append(f'<li>Pipeline <b>{p.name}</b>: <a href="{host}/pipelines/{p.pipeline_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
