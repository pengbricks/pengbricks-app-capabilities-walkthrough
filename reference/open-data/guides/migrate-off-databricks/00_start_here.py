# Databricks notebook source
# MAGIC %md
# MAGIC # Migrating off Databricks
# MAGIC
# MAGIC This guide builds the first artifact of an exit plan: an inventory of every table in the shared schema, with its format, where the files live, whether Iceberg clients can read it, which Delta features outside readers may not support, and a portability verdict. It then prints the settings an outside engine uses to read a table through the Unity Catalog Iceberg REST catalog. Nothing here runs against an outside system, and nothing leaves the workspace.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_exit_inventory` | Reads `information_schema.tables`, table properties, and `DESCRIBE DETAIL` for the schema, then writes the `exit_inventory` table. |
# MAGIC | `02_read_from_outside` | Checks the metastore setting, then prints the Iceberg REST endpoint and the PyIceberg configuration for the first Iceberg-readable table. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-migrate-off-databricks` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema to inventory. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: `exit_inventory` is replaced on each run. Nothing else is created or changed.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC `01_exit_inventory` needs no setup beyond `SELECT` and `USE SCHEMA` on the schema. `02_read_from_outside` only prints settings, but a real outside read needs this once:
# MAGIC
# MAGIC 1. **External data access on the metastore.** A metastore admin turns it on. The notebook reports the current value.
# MAGIC    ```bash
# MAGIC    databricks metastores update <metastore-id> --external-access-enabled
# MAGIC    ```
# MAGIC 2. **EXTERNAL USE SCHEMA** on the schema for the principal that the outside engine uses:
# MAGIC    ```sql
# MAGIC    GRANT EXTERNAL USE SCHEMA ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params, JOB_TAG
JOB_KEY = "capability_guides_migrate_off_databricks"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
