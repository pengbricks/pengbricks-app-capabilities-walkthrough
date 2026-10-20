# Databricks notebook source
# MAGIC %md
# MAGIC # Model performance and drift
# MAGIC
# MAGIC This guide scores nine monthly batches of real retail customers (UCI Online Retail II, CC BY 4.0) with a baseline model trained on the 2010-09-01 snapshot, records operational and model metrics for each, and measures how far each feature has moved from the training data. Each batch is the customer base at a later snapshot, so the drift is real, not injected. When PSI or the mean shift passes its threshold, the job trains a challenger model and records how it compares with the current `prod` model. A SQL alert emails the owner when the newest batch drifts past the PSI threshold.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_train_baseline` | Writes `drift_training_data`, trains the baseline model, registers it in Unity Catalog and sets the `prod` alias. |
# MAGIC | `02_score_batches` | Scores nine monthly batches (2010-10-01 to 2011-06-01) with `models:/...@prod` and writes `batch_scores`, `ops_metrics` and `model_metrics`. |
# MAGIC | `03_detect_drift` | Computes PSI and mean shift per batch and feature into `drift_metrics`, and passes `breach` and `first_breach_batch` on. |
# MAGIC | `04_retrain_candidate` | Trains a challenger on the training data plus batches 1 to 8, compares it with `prod`, sets the `challenger` alias and logs to `retraining_log`. The job runs it only when a condition task sees `breach = true`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-model-drift` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. The condition task has no notebook: run by hand, `04` checks `drift_metrics` itself and stops if no feature breached.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and registered model. |
# MAGIC | `use_case` | Spec under `use_cases/` with the batch dates and thresholds. |
# MAGIC | `experiment` | Workspace path of the MLflow experiment. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_model_drift"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'experiment'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
