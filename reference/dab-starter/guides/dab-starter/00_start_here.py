# Databricks notebook source
# MAGIC %md
# MAGIC # Running a Declarative Automation Bundle
# MAGIC
# MAGIC Safe to rerun: it only lists links to the deployed job and pipeline and writes nothing.
# MAGIC
# MAGIC You are looking at files a bundle deployed to this workspace. The bundle holds one serverless Lakeflow Declarative Pipeline and one job that runs it. The pipeline generates 100,000 synthetic orders with `dbldatagen` (bronze), drops the ones that break a rule (silver), and totals revenue per day and category (gold).
# MAGIC
# MAGIC ## Where each piece is
# MAGIC
# MAGIC | File | What it is |
# MAGIC |---|---|
# MAGIC | `databricks.yml` | The bundle: name, variables, and the `dev` and `prod` targets. |
# MAGIC | `resources/orders.pipeline.yml` | The pipeline: serverless, with `dbldatagen` listed as a dependency. |
# MAGIC | `resources/orders.job.yml` | The job: runs the pipeline, then `01_check_gold`. |
# MAGIC | `resources/orders.schema.yml` | The schema the tables land in. |
# MAGIC | `guides/dab-starter/pipeline/orders.py` | The pipeline source: `orders_bronze`, `orders_silver`, `orders_daily_revenue`. |
# MAGIC | `01_check_gold` | Counts rows across the layers and prints the expectation results. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `dab-starter-orders` from Jobs & Pipelines, or use `databricks bundle run capability_guides_dab_starter` from your terminal. Change a value in the YAML, run `databricks bundle deploy`, and run again to see the change here.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Catalog that holds the schema. |
# MAGIC | `schema` | Schema the bundle created. Development mode adds a `dev_<you>_` prefix. |
# MAGIC | `pipeline_id` | The deployed pipeline, used to read its event log. |
# MAGIC | `row_count` | Orders the pipeline generated. |
# MAGIC
# MAGIC Each is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params, JOB_TAG
JOB_KEY = "capability_guides_dab_starter"
params = load_params(dbutils, JOB_KEY, ["catalog", "schema"])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
