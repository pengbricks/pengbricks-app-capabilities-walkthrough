# Databricks notebook source
# MAGIC %md
# MAGIC # Online model scoring
# MAGIC
# MAGIC This guide trains a small model, registers it in Unity Catalog, deploys it to a Model Serving endpoint, and scores the endpoint over HTTPS with an OAuth token from the Databricks SDK. It times every request and records how the endpoint answers bad requests. A second job deletes the endpoint, so nothing keeps running afterwards.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_train_register` | Generates training data from the use-case spec (dbldatagen, fixed seed), trains a scikit-learn pipeline, registers it in Unity Catalog with the `champion` alias. |
# MAGIC | `02_deploy_endpoint` | Creates the Small, scale-to-zero endpoint, or updates it in place if it exists, and waits until it is ready. |
# MAGIC | `03_score_and_measure` | Scores the endpoint with OAuth: first request, 50 warm requests, a concurrent burst, and four failure scenarios. Writes `scoring_latency` and `scoring_errors`. |
# MAGIC | `04_teardown_endpoint` | Deletes the endpoint and confirms it is no longer listed. Run by the teardown job. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-realtime-scoring` (or **Quick run** in the app), then run `capability-guides-realtime-scoring-teardown` to delete the endpoint. To run by hand, open `01`, `02`, `03` in order and use Run all in each. Run `04` when you are done. Opening this notebook creates nothing.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the registered model. |
# MAGIC | `use_case` | Spec under `use_cases/` with the features, label, endpoint size and request counts. |
# MAGIC | `endpoint_name` | Name of the serving endpoint. |
# MAGIC | `run_id` | Set by the job on `03_score_and_measure`. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_realtime_scoring"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'endpoint_name'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
keys = {JOB_KEY, JOB_KEY + "_teardown"}
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) in keys:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
