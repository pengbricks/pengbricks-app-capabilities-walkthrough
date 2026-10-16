# Databricks notebook source
# MAGIC %md
# MAGIC # Experiment tracking and rerun
# MAGIC
# MAGIC This guide shows that a tracked run can be reproduced. A first run records its data version, code hash and environment as MLflow tags. The job then appends new rows to the table. A second run reads only those records, trains again on the recorded Delta version, and checks that the metric matches. Only the recorded version reproduces the result: the AUC on the latest data is recorded as a control.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_tracked_run` | Writes `experiment_data`, trains, and logs the metric with tags for data version, release, code hash and package versions. |
# MAGIC | `02_append_new_data` | Appends new rows, only for keys the table does not have yet, so the table moves past the recorded version. |
# MAGIC | `03_rerun_and_compare` | Reads the tracked run's tags, trains on `VERSION AS OF` the recorded version, and fails if the AUC differs by more than the tolerance or the code hash changed. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-experiment-rerun` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Run by hand, `03` reruns the most recent `tracked-run` in the experiment.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for `experiment_data` and `experiment_reproductions`. |
# MAGIC | `use_case` | Spec under `use_cases/` with the data, features and tolerances. |
# MAGIC | `release` | Release identifier (a Git commit SHA in CI) recorded as the `git_sha` tag. |
# MAGIC | `experiment` | Workspace path of the MLflow experiment. |
# MAGIC | `run_id` | `03` only. The tracked run to reproduce. Set by the job. Blank takes the latest tracked run. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_experiment_rerun"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'release', 'experiment'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
