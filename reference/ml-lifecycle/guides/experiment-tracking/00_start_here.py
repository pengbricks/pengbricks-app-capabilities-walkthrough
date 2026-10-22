# Databricks notebook source
# MAGIC %md
# MAGIC # Experiment tracking and rerun
# MAGIC
# MAGIC This guide shows that a tracked run can be reproduced. A first run trains on a customer snapshot of the UCI Online Retail II data (CC BY 4.0) and records its data version, code hash and environment as MLflow tags. The job then appends the customers who are new by a later snapshot. A second run reads only those records, trains again on the recorded Delta version, and checks that the metric matches. Only the recorded version reproduces the result: the AUC on the latest data is recorded as a control.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_tracked_run` | Writes `experiment_data` (the 2010-09-01 snapshot), trains, and logs the metric with tags for data version, release, code hash and package versions. |
# MAGIC | `02_append_new_data` | Appends the customers who are new by the 2010-12-01 snapshot, only for keys the table does not have yet, so the table moves past the recorded version. |
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
# MAGIC
# MAGIC Safe to rerun: this notebook only reads and links the deployed job.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle.** Deploy `reference/foundation` first. It creates the shared schema this guide writes to.
# MAGIC 2. **Schema privileges.** The job creates tables, reads and writes the source volume, and appends run history:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, SELECT, MODIFY, READ VOLUME, WRITE VOLUME ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC 3. **Outbound internet access.** The first notebook downloads the UCI Online Retail II zip (CC BY 4.0) into the source volume, and `%pip` installs packages from PyPI. The compute needs outbound HTTPS to `archive.ics.uci.edu` and to PyPI (or an internal PyPI mirror). On serverless compute, allow both in the workspace network policy. The download runs once and later runs reuse the zip in the volume. The task stops before it changes anything if the host is unreachable. Without internet, copy the zip into the source volume yourself (the `source_volume` job parameter names it):
# MAGIC    ```bash
# MAGIC    databricks fs cp ./online+retail+ii.zip dbfs:/Volumes/<catalog>/<schema>/<source-volume>/online_retail_ii.zip
# MAGIC    ```

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
