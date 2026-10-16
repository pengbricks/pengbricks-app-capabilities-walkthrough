# Databricks notebook source
# MAGIC %md
# MAGIC # Transformation patterns
# MAGIC
# MAGIC This guide shows ten common transformation patterns as Lakeflow Declarative Pipeline materialized views: lookup enrichment, joins, string functions, null handling, dates, casting with a reject path, running totals, pivot and unpivot, last record per group, and per-group iteration. Each view is checked against an independent query on the source tables.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_sources` | Writes the source tables: a small regions lookup, customers and orders with messy values. |
# MAGIC | `02_run_pipeline` | Runs the pipeline (standalone) or inspects its output (in the job), and shows the output tables and expectation results. |
# MAGIC | `03_check_row_counts` | Compares each view's row count with an independent query on the sources and records the result. |
# MAGIC | `pipeline/` | The pipeline source: ten SQL files, one or two materialized views each. They only run inside a pipeline. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability_guides_transformations` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. `02_run_pipeline` starts the pipeline for you.
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
JOB_KEY = "capability_guides_transformations"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

pipelines = [p for p in w.pipelines.list_pipelines() if "capability-guides-transformations" in (p.name or "")]
for p in pipelines:
    links.append(f'<li>Pipeline <b>{p.name}</b>: <a href="{host}/pipelines/{p.pipeline_id}">open</a></li>')
displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
