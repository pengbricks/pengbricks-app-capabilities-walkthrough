# Databricks notebook source
# MAGIC %md
# MAGIC # REST API ingestion
# MAGIC
# MAGIC This guide pulls a paginated, token-authenticated REST API into Delta. The client logs in, pages through the records, refreshes the token before it expires, retries on 429 and 5xx, and writes one request-log row per HTTP attempt.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_pull_rest_api` | Pulls every page, writes `api_users`, `api_request_log` and `api_pull_runs`, and fails if the counts disagree with the API total. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-rest-api` (or **Quick run** in the app). To run by hand, open `01_pull_rest_api` and use Run all.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the `source_landing` volume. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the data, sources and checks. |
# MAGIC | `run_id` | Set by the job on the notebooks that log results. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_rest_api"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
