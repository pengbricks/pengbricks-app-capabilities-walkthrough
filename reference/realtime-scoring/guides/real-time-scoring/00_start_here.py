# Databricks notebook source
# MAGIC %md
# MAGIC # Online model scoring
# MAGIC
# MAGIC This guide trains a credit default model on UCI Default of Credit Card Clients (CC BY 4.0), registers it in Unity Catalog, deploys it to a Model Serving endpoint, and scores the endpoint over HTTPS with an OAuth token from the Databricks SDK. It times every request and records how the endpoint answers bad requests. A second job deletes the endpoint, so nothing keeps running afterwards.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_train_register` | Lands the public card-holder data, reads the spec's four features from its columns, trains a scikit-learn pipeline, registers it in Unity Catalog with the `champion` alias. |
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
# MAGIC
# MAGIC Safe to rerun: this notebook only reads and links the deployed job.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle.** Deploy `reference/foundation` first. It creates the shared schema this guide writes to.
# MAGIC 2. **Schema privileges.** The job creates tables, registers the credit default model in Unity Catalog, and writes to the source volume:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, CREATE MODEL, SELECT, MODIFY, READ VOLUME, WRITE VOLUME ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC 3. **Model Serving.** `02_deploy_endpoint` creates the endpoint. Serverless Model Serving must be available in the workspace region, and `<principal>` must be allowed to create endpoints. The endpoint keeps running until you delete it. Delete it with the teardown job:
# MAGIC    ```bash
# MAGIC    databricks bundle run capability_guides_realtime_scoring_teardown --target dev
# MAGIC    ```
# MAGIC 4. **Scoring callers.** The scoring task calls the endpoint with the OAuth token of `<principal>`. Anyone else who scores it needs CAN QUERY on the endpoint (endpoint **Permissions** in the Serving UI).
# MAGIC 5. **Outbound internet access.** `01_train_register` downloads the UCI Default of Credit Card Clients zip (CC BY 4.0) into the source volume, and `%pip` installs packages from PyPI. The compute needs outbound HTTPS to `archive.ics.uci.edu` and to PyPI (or an internal PyPI mirror). On serverless compute, allow both in the workspace network policy. The download runs once and later runs reuse the zip. The task stops before it changes anything if the host is unreachable. Without internet, copy the zip into the source volume yourself (the `source_volume` job parameter names it):
# MAGIC    ```bash
# MAGIC    databricks fs cp ./default+of+credit+card+clients.zip dbfs:/Volumes/<catalog>/<schema>/<source-volume>/credit_card_default.zip
# MAGIC    ```

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
