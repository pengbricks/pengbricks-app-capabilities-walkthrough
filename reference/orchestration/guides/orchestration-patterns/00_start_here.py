# Databricks notebook source
# MAGIC %md
# MAGIC # Orchestration patterns
# MAGIC
# MAGIC This guide shows one Lakeflow job that chains tasks with passed values, fans out to two parallel branches, calls an external process with a retry policy, and branches on a condition. A second job pauses every scheduled guide job in one operation and restores only the ones it paused.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC Job `capability-guides-orchestration`:
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_extract` | Generates the raw orders and passes the row count to later tasks as task values. |
# MAGIC | `02_validate` | Reads that task value, rejects bad rows, and publishes the valid-row count. |
# MAGIC | `03_branch` | Aggregates valid rows by one dimension. The job runs it twice, once for `region` and once for `status`, in parallel. |
# MAGIC | `04_join` | Waits for both branches, reads each branch's task value, and writes one summary row. |
# MAGIC | `05_external_call` | Runs a shell command and an HTTP request. The job sets `fail_first_attempt` so attempt 0 fails and the retry succeeds. |
# MAGIC | `06_publish` | Runs after the job's condition task: publishes the summary when valid rows exceed `min_valid_rows`, otherwise holds it. |
# MAGIC | `07_record_run` | Records each task's state, attempts and duration for the run. |
# MAGIC
# MAGIC Job `capability-guides-bulk-pause`:
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `08_bulk_pause_prepare` | Creates a scheduled probe job and records the "before" states of every tagged scheduled job. |
# MAGIC | `09_bulk_pause_pause_all` | Pauses every unpaused schedule and records which jobs it changed. |
# MAGIC | `10_bulk_pause_resume_all` | Restores only the jobs this run paused. |
# MAGIC | `11_bulk_pause_cleanup_probe` | Deletes the probe job. The job runs it even if an earlier task failed. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-orchestration`, then `capability-guides-bulk-pause` (or **Quick run** in the app). To run by hand, open `01` to `07` in order and use Run all in each. The condition task has no notebook: run by hand, `06_publish` makes the same decision itself. Run `08` to `11` in order with the same `run_id` so resume finds what pause changed.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the sample data. |
# MAGIC | `min_valid_rows` | Orchestration job only. The condition publishes when valid rows exceed this. |
# MAGIC | `run_id` | Set by the job on the notebooks that log. Defaults to `manual` when run by hand. |
# MAGIC | `dimension` | `03_branch` only. Set by the job to `region` or `status`. Blank or `all` runs both. |
# MAGIC | `outcome` | `06_publish` only. Set by the job to `publish` or `hold`. Blank decides from the valid-row count. |
# MAGIC | `fail_first_attempt` | `05_external_call` only. The job sets `true`. Run by hand it defaults to `false`. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_orchestration"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'min_valid_rows'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
keys = {JOB_KEY, "capability_guides_bulk_pause"}
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) in keys:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
