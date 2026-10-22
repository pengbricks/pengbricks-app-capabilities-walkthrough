# Databricks notebook source
# MAGIC %md
# MAGIC # Data ingestion and feature preparation
# MAGIC
# MAGIC This guide downloads UCI Online Retail II (CC BY 4.0, 1,067,371 invoice lines from a UK online retailer), builds a customer snapshot with a churn label, builds a Unity Catalog feature table from it with quality checks, freezes a versioned training set by time travel, and records the lineage Unity Catalog captured for the three tables downstream of the invoice lines.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_land_source` | Downloads the dataset into a volume, checks its pinned SHA-256, writes the invoice lines to `ml_retail_transactions` and the customer snapshot to the source table, and passes the Delta version on. |
# MAGIC | `02_build_features` | Builds the feature table (Feature Engineering client, or a primary-key Delta table if unavailable) and runs the range, null and key checks. |
# MAGIC | `03_snapshot_training_set` | Joins the feature table to the labels at recorded Delta versions and saves `training_set_v<version>`. |
# MAGIC | `04_record_lineage` | Reads table lineage for the feature table and training set from Unity Catalog and records it. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-feature-preparation` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Run by hand, `03` and `04` pick up the latest versions themselves.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the transactions, source, feature and training-set tables. |
# MAGIC | `use_case` | Spec under `use_cases/` with the dataset, snapshot date, features and quality ranges. |
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
# MAGIC 2. **Schema privileges.** The job creates tables and a feature table through the Feature Engineering client, and writes to the source volume:
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
JOB_KEY = "capability_guides_feature_preparation"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
