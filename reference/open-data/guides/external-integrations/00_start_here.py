# Databricks notebook source
# MAGIC %md
# MAGIC # External tool integrations
# MAGIC
# MAGIC This guide shows two ways partner tools reach governed data. A BI-style client queries a SQL warehouse through the Databricks SQL Connector for Python, and Lakehouse Federation queries an external Postgres database in place through a Unity Catalog connection. A Lakebase project stands in for the external database.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_prepare_data` | Writes the `sharing_orders` and `sharing_products` sample tables from the use-case spec. |
# MAGIC | `02_sql_connector_client` | Connects to the warehouse with the SQL Connector, runs an aggregate and a parameterised query, and cross-checks both against Spark. |
# MAGIC | `03_lakehouse_federation` | Seeds a Postgres table, creates a UC connection and foreign catalog (or uses `remote_query`), queries it in place and joins it to a UC table, then drops the connection. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-external-integrations` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. `02_sql_connector_client` and `03_lakehouse_federation` only need `01_prepare_data` to have run once.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and views. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the data and settings. |
# MAGIC | `warehouse_id` | SQL warehouse that `02_sql_connector_client` connects to. |
# MAGIC | `lakebase_project` | Lakebase project that stands in for the external Postgres database. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: tables are replaced, the Postgres table is dropped and reseeded, and the connection and foreign catalog are dropped at the end.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`. A metastore admin runs item 2.
# MAGIC
# MAGIC 1. **A Postgres database to federate.** `03_lakehouse_federation` reads the `production` branch of the Lakebase project named by the `lakebase_project` variable (default `capability-guides`) and seeds a table in it. Create the project if it does not exist. A new project comes with the `production` branch, the `databricks_postgres` database, and the `primary` endpoint:
# MAGIC    ```bash
# MAGIC    databricks postgres create-project capability-guides
# MAGIC    ```
# MAGIC    To use another project, deploy with `--var lakebase_project=<project-id>`. To federate a database outside Databricks, change `integrations.federation` in `use_cases/general.yml` and make the host reachable from serverless compute.
# MAGIC 2. **Connection and catalog privileges.** The task creates a Unity Catalog connection, and a foreign catalog if allowed:
# MAGIC    ```sql
# MAGIC    GRANT CREATE CONNECTION ON METASTORE TO `<principal>`;
# MAGIC    GRANT CREATE CATALOG ON METASTORE TO `<principal>`;
# MAGIC    ```
# MAGIC    Without `CREATE CATALOG` the task records `foreign_catalog` as `BLOCKED` and reads through `remote_query`. Without `CREATE CONNECTION` it fails at the connection.
# MAGIC 3. **SQL warehouse.** `02_sql_connector_client` queries the warehouse in the `warehouse_id` variable. The principal needs CAN USE on it:
# MAGIC    ```bash
# MAGIC    databricks warehouses list
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_external_integrations"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'lakebase_project', 'warehouse_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
