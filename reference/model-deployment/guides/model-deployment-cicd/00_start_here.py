# Databricks notebook source
# MAGIC %md
# MAGIC # Model release pipeline
# MAGIC
# MAGIC This guide takes a model from training to a live endpoint in one job. It trains a small scikit-learn churn model with MLflow 3 on UCI Online Retail II (CC BY 4.0), registers it in Unity Catalog, runs automated tests, promotes it to `@champion` only when someone approved it, deploys it to Model Serving, and appends a row to a release history table.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_train_and_register` | Lands the public data, builds the 2010-09-01 snapshot, trains, and registers a new model version with release tags. |
# MAGIC | `02_run_tests` | Checks the signature, scores a smoke test, and applies the AUC threshold and the `@champion` comparison. Sets `@challenger` when all pass, fails the run otherwise. |
# MAGIC | `03_approval_gate` | Promotes `@challenger` to `@champion` when `approved_by` or a `model_approvals` row supplies an approver. Otherwise it stops and leaves the model unpromoted. |
# MAGIC | `04_deploy_endpoint` | Serves `@champion` on a small scale-to-zero endpoint, waits for READY, and scores twice to measure latency. |
# MAGIC | `05_record_release` | Appends one row to `model_release_history` and tags the model version with it. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-model-release` (or **Quick run** in the app). Pass `approved_by` to promote and deploy. To run by hand, open the notebooks in order and use Run all in each. Run by hand, each notebook works on the latest model version.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the schema and the registered model. |
# MAGIC | `schema` | Schema for the model, training data and release history. |
# MAGIC | `use_case` | Spec under `use_cases/` with the dataset, label, model name and features. |
# MAGIC | `release` | Release identifier (a Git commit SHA in CI) recorded on the model version. |
# MAGIC | `experiment` | Workspace path of the MLflow experiment. |
# MAGIC | `min_auc` | Minimum holdout AUC for `@challenger`. |
# MAGIC | `max_auc_regression` | How far below the `@champion` AUC a candidate may fall. |
# MAGIC | `champion_alias`, `challenger_alias` | Alias names for the approved and the tested version. |
# MAGIC | `endpoint_name` | Serving endpoint to create or update. |
# MAGIC | `workload_size`, `scale_to_zero` | Endpoint size and idle behavior. |
# MAGIC | `target` | Bundle target, recorded in the release history. |
# MAGIC | `approved_by` | Approver name. Blank stops the run at the gate. Not required, so it is not resolved from the job. |
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
# MAGIC 2. **Schema privileges.** The job creates tables, registers the churn model in Unity Catalog, and writes to the source volume:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, CREATE MODEL, SELECT, MODIFY, READ VOLUME, WRITE VOLUME ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC 3. **Model Serving.** `04_deploy_endpoint` creates or updates a Model Serving endpoint. Serverless Model Serving must be available in the workspace region, and `<principal>` must be allowed to create endpoints. Check afterwards with:
# MAGIC    ```bash
# MAGIC    databricks serving-endpoints list
# MAGIC    ```
# MAGIC 4. **Outbound internet access.** The first notebook downloads the UCI Online Retail II zip (CC BY 4.0) into the source volume, and `%pip` installs packages from PyPI. The compute needs outbound HTTPS to `archive.ics.uci.edu` and to PyPI (or an internal PyPI mirror). On serverless compute, allow both in the workspace network policy. The download runs once and later runs reuse the zip. The task stops before it changes anything if the host is unreachable. Without internet, copy the zip into the source volume yourself (the `source_volume` job parameter names it):
# MAGIC    ```bash
# MAGIC    databricks fs cp ./online+retail+ii.zip dbfs:/Volumes/<catalog>/<schema>/<source-volume>/online_retail_ii.zip
# MAGIC    ```
# MAGIC 5. **Approver.** The approval gate moves `@champion` only when it finds an approver. Without one the job stops at the gate, the endpoint is not deployed, and `@champion` stays as it was. Pass a name when you run the job:
# MAGIC    ```bash
# MAGIC    databricks bundle run capability_guides_model_release --target dev --params approved_by=<name>
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_model_release"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'release', 'experiment', 'min_auc', 'max_auc_regression', 'champion_alias', 'challenger_alias', 'endpoint_name', 'workload_size', 'scale_to_zero', 'target'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
