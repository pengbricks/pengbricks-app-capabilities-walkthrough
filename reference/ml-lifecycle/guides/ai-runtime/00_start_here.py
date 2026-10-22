# Databricks notebook source
# MAGIC %md
# MAGIC # AI Runtime: train on serverless GPU
# MAGIC
# MAGIC This guide trains a small PyTorch churn classifier on AI Runtime (serverless GPU compute) from the UCI Online Retail II snapshot the other ML guides use (CC BY 4.0, checksum verified), logs it to MLflow, and registers it in Unity Catalog. A second notebook runs the same model with `@distributed` across the GPUs of one node. By default it stays on one GPU.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | Compute | What it does |
# MAGIC |---|---|---|
# MAGIC | `00_prepare_data` | Serverless CPU | Downloads the UCI zip, builds the 2010-09-01 customer snapshot, and writes one Parquet file to a Unity Catalog volume. AI Runtime has no local Spark, so Spark work stays here. |
# MAGIC | `01_train_on_gpu` | AI Runtime, 1xA10 | Trains on the attached GPU, logs parameters, loss, and holdout AUC, registers `churn_classifier_gpu`, and moves the `gpu_trained` alias. |
# MAGIC | `02_distributed` | AI Runtime, 1xA10 by default | Same model. With `distributed=true` on 8xH100 it uses `databricks.air.distributed` (Beta, single node). Moves the `gpu_distributed` alias. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-ai-runtime`. To run by hand, open `01_train_on_gpu` and choose **Serverless GPU** in the compute menu with **1xA10**; run `00_prepare_data` first on serverless CPU.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog`, `schema` | Where the table, model, and volume path live. |
# MAGIC | `use_case` | Spec under `use_cases/` with the features and split. |
# MAGIC | `source_volume` | Volume that holds the downloaded zip and the Parquet snapshot. |
# MAGIC | `release` | Release identifier recorded as a run tag. |
# MAGIC | `experiment` | Workspace path of the MLflow experiment (the bundle's shared one). |
# MAGIC | `epochs` | Training epochs. 20 takes a few minutes on one A10. |
# MAGIC | `distributed` | `02` only. `false` (default) trains on one GPU, `true` uses every GPU on the node. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name.
# MAGIC
# MAGIC ## Cost while idle
# MAGIC
# MAGIC Nothing here costs money while idle. AI Runtime is serverless: a task bills while it runs, and the job creates no cluster, endpoint, or schedule. The registered model, the table, and the Parquet file are small storage.
# MAGIC
# MAGIC Safe to rerun: this notebook only reads and links the deployed job.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle.** Deploy `reference/foundation` first. It creates the shared schema this guide writes to.
# MAGIC 2. **Schema privileges.** The job creates a table and a model, and reads and writes the source volume:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, CREATE MODEL, SELECT, MODIFY, READ VOLUME, WRITE VOLUME ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC 3. **Serverless GPU availability.** AI Runtime must be available in the workspace and its geo, and GPU availability varies by workspace. Check **Serverless GPU** in the notebook compute menu. If the workspace uses the compliance security profile, an admin must enable the AI Runtime previews. FedRAMP High and DoD IL5 are not supported.
# MAGIC 4. **Accelerator and quota.** The default job uses `GPU_1xA10`. In the bundle schema (CLI 1.17) the task-level `compute.hardware_accelerator` field is **Beta**, and so are the 1xA10, 1xH100, and 8xH100 values. If your workspace has no A10 quota, deploy with `--var gpu_accelerator=GPU_1xH100`. Quota and capacity are workspace settings, so ask your account team if a run waits for a GPU.
# MAGIC 5. **Multi-GPU run (optional).** `@distributed` is Beta and needs 8xH100 or 8xB300. The docs call 8xB300 a Public Preview waitlist, and the bundle schema marks it Private Preview, so this guide sets only 8xH100:
# MAGIC    ```bash
# MAGIC    databricks bundle deploy --target dev --var distributed_accelerator=GPU_8xH100 ...
# MAGIC    databricks bundle run capability_guides_ai_runtime --target dev --params distributed=true
# MAGIC    ```
# MAGIC 6. **Outbound internet access.** `00_prepare_data` downloads the zip from `archive.ics.uci.edu`, and the GPU tasks install packages from PyPI. Allow both in the workspace network policy, or copy the zip into the source volume yourself.
# MAGIC 7. **Bundles and AI Runtime.** A bundle can also declare an `ai_runtime_task` (Public Preview): a command script run on one or more GPU nodes, with `experiment` and one `deployments` entry holding `command_path` and `compute` (`accelerator_type` and `accelerator_count`). This guide uses notebook tasks with a GPU `compute` block, which is what the notebooks need. If your CLI is older than 1.17 and rejects `compute.hardware_accelerator`, create the task in the Jobs UI: add a notebook task, then in **Compute** choose **Serverless GPU** and the accelerator.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_ai_runtime"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'release', 'experiment'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
