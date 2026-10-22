# Databricks notebook source
# MAGIC %md
# MAGIC # Apache Iceberg support
# MAGIC
# MAGIC This guide creates a managed Iceberg table in Unity Catalog, appends to it, evolves its schema, and uses time travel. It then reads the same table from outside Spark with PyIceberg through the Unity Catalog Iceberg REST catalog, with vended credentials, and compares the result to Spark.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_managed_iceberg_table` | Creates `USING ICEBERG`, appends a second batch, adds a column, reads an earlier version, grants `EXTERNAL USE SCHEMA`. |
# MAGIC | `02_read_through_irc` | Configures PyIceberg for the REST catalog, reads the table and a filtered slice, and compares the counts to Spark. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-iceberg` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and views. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the data and settings. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: the Iceberg table is dropped and rebuilt, and each notebook replaces its own rows in `iceberg_checks`.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **External data access on the metastore.** A metastore admin turns it on. Without it the Iceberg REST catalog refuses PyIceberg and `02_read_through_irc` stops with a message that says so:
# MAGIC    ```bash
# MAGIC    databricks metastores update <metastore-id> --external-access-enabled
# MAGIC    ```
# MAGIC    Get `<metastore-id>` from `databricks metastores current`.
# MAGIC 2. **EXTERNAL USE SCHEMA.** `01_managed_iceberg_table` grants it on the guide schema to the job identity. The catalog owner or a metastore admin can grant it first, which also covers a different reader:
# MAGIC    ```sql
# MAGIC    GRANT EXTERNAL USE SCHEMA ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_iceberg"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
