# Databricks notebook source
# MAGIC %md
# MAGIC # Support and recovery
# MAGIC
# MAGIC The `capability-guides-operational-support` job fails one task on purpose, then triages every failed capability guide run, classifies each error, and routes it to an owner from an `on_call` table. A second job, `capability-guides-support-repair`, repairs the failed run through the Jobs API repair endpoint and records the outcome. Everything lands in `support_incidents`.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | Job | What it does |
# MAGIC |---|---|---|
# MAGIC | `01_setup_on_call` | operational support | Overwrites the `on_call` ownership table from the spec. |
# MAGIC | `02_write_with_retry` | operational support | Fails its first attempt, passes on the retry, and merges 25 work items by id. |
# MAGIC | `03_fragile_step` | operational support | Fails by design until the run is repaired. |
# MAGIC | `04_triage` | operational support | Finds failed tasks, classifies the errors, routes each through `on_call`, and merges them into `support_incidents`. |
# MAGIC | `05_repair_failed_run` | support repair | Repairs the failed `fragile_step` through the Jobs API and marks the incident `repaired`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run `capability-guides-operational-support` first. It ends with one failed task by design. Then run `capability-guides-support-repair` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Run by hand, `03` passes unless you set `repair_count` to 0.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for `on_call`, `support_work_items` and `support_incidents`. |
# MAGIC | `use_case` | Spec under `use_cases/` with error classes, severities and the `on_call` rows. |
# MAGIC | `execution_count` | `02` only. The attempt number, set by the job. Blank means a retry, so it succeeds. |
# MAGIC | `repair_count` | `03` only. 0 on the original run, 1 after a repair. Set by the job. Blank means repaired. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_operational_support"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == "capability_guides_support_repair":
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
