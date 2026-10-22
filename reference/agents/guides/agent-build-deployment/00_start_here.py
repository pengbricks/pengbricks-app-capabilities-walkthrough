# Databricks notebook source
# MAGIC %md
# MAGIC # Building and shipping agents
# MAGIC
# MAGIC This guide builds a tool-calling support assistant as an MLflow `ResponsesAgent`, tests it locally with tracing, logs it from code, and registers a version in Unity Catalog. It then deploys the version to a small scale-to-zero Model Serving endpoint, calls it with tracing on, and records a build record with the dependencies and owners.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_prepare_tool` | Creates the sample orders, the email mask and the `order_status` function the agent calls. |
# MAGIC | `02_log_and_register` | Tests the agent locally, logs it with its declared resources, registers a version and sets `@champion`. |
# MAGIC | `03_deploy_endpoint` | Creates or updates the serving endpoint and waits for READY. |
# MAGIC | `04_call_and_record` | Calls the endpoint twice, asserts the tool span exists, and appends a row to `agent_build_record`. |
# MAGIC
# MAGIC The teardown notebook, `../agent-framework-support/07_teardown`, belongs to the job `capability-guides-agent-teardown`, shared with the gateway guide. Run it when you finish so no endpoint is left.
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-agent-build` (or **Quick run** in the app), then `capability-guides-agent-teardown`. To run by hand, open the notebooks in order and use Run all in each. Run by hand, `03` and `04` use the version `@champion` points to.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema, the tool and the registered agent. |
# MAGIC | `schema` | Schema for the sample data, the tool, the agent model and the record tables. |
# MAGIC | `use_case` | Spec under `use_cases/` with the data, the tool, the agents and the gateway services. |
# MAGIC | `release` | Release identifier recorded on the model version and in the build record. |
# MAGIC | `experiment` | Workspace path of the MLflow experiment that holds the traces. |
# MAGIC | `experiment_id` | Id of that experiment, passed to the endpoint for tracing. |
# MAGIC | `warehouse_id` | SQL warehouse the agent's tool runs on. |
# MAGIC | `version`, `endpoint`, `model_run_id`, `ready_seconds` | Set by the job from earlier tasks. Blank takes the champion version and the spec's endpoint. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: this notebook only reads and links the deployed job.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_agent_build"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'release', 'experiment', 'experiment_id', 'warehouse_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == "capability_guides_agent_teardown":
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
