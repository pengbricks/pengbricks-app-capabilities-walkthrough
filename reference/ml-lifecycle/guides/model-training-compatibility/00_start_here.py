# Databricks notebook source
# MAGIC %md
# MAGIC # Model training and compatibility
# MAGIC
# MAGIC This guide trains a scikit-learn model with MLflow and registers it in Unity Catalog. The training data is a customer churn snapshot built from UCI Online Retail II (CC BY 4.0), which the first notebook downloads and checks against a pinned SHA-256. It also brings a pickled model, saved by an older runtime, into Unity Catalog as a pyfunc, and checks that the imported model reproduces its recorded baseline metric. A change log lists the package versions that differ between the old runtime and this one.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_export_legacy_model` | Downloads the dataset, builds the churn training table (3,321 customers at 2010-09-01), trains a model, pickles it to the `legacy_models` volume, and writes a sidecar JSON with the baseline AUC, training table version and package versions. |
# MAGIC | `02_train_native` | Trains the same model with MLflow tracking and registers it as `churn_classifier` with the `trained` alias. |
# MAGIC | `03_import_legacy_model` | Wraps the pickle as a pyfunc, registers it as `churn_classifier_imported` with the `imported` alias, reproduces the baseline AUC within tolerance, and records the change log. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-model-training` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, volume and registered models. |
# MAGIC | `use_case` | Spec under `use_cases/` with the data, features and tolerances. |
# MAGIC | `release` | Release identifier recorded as a tag on the MLflow runs. |
# MAGIC | `experiment` | Workspace path of the MLflow experiment. |
# MAGIC | `volume` | Volume that holds the pickled legacy model. |
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
# MAGIC 2. **Schema privileges.** The job creates tables, registers `churn_classifier` and `churn_classifier_imported` in Unity Catalog, and writes to the source and legacy-model volumes:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, CREATE MODEL, SELECT, MODIFY, READ VOLUME, WRITE VOLUME ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC 3. **Outbound internet access.** The first notebook downloads the UCI Online Retail II zip (CC BY 4.0) into the source volume, and `%pip` installs packages from PyPI. The compute needs outbound HTTPS to `archive.ics.uci.edu` and to PyPI (or an internal PyPI mirror). On serverless compute, allow both in the workspace network policy. The download runs once and later runs reuse the zip in the volume. The task stops before it changes anything if the host is unreachable. Without internet, copy the zip into the source volume yourself (the `source_volume` job parameter names it):
# MAGIC    ```bash
# MAGIC    databricks fs cp ./online+retail+ii.zip dbfs:/Volumes/<catalog>/<schema>/<source-volume>/online_retail_ii.zip
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_model_training"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'release', 'experiment', 'volume'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
