# Databricks notebook source
# MAGIC %md
# MAGIC # App development with Lakebase
# MAGIC
# MAGIC Safe to rerun. This guide walks the main steps of building an app on Lakebase, the managed Postgres on Databricks. It connects with an OAuth token, syncs a Delta table into Postgres, sends app writes back to Delta, branches for dev work, adds vector search, and registers the database in Unity Catalog.
# MAGIC
# MAGIC The Lakebase project comes from the bundle (`resources/lakebase.postgres.yml`). Its compute scales to zero after five idle minutes, so an idle project costs close to nothing.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_connect_and_write` | Opens a psycopg pool that mints an OAuth token for each connection, retries the first connection for scale to zero, and writes and reads `orders`. |
# MAGIC | `02_sync_delta_table` | Creates a Delta table, syncs it into Postgres in Triggered mode, and reads it from Postgres. |
# MAGIC | `03_write_back` | Starts Lakebase Change Data Feed (Public Preview) on the app schema, changes two orders, and reads the Delta history table. |
# MAGIC | `04_dev_branch` | Creates an expiring dev branch from production, shows that writes on it stay off production, and deletes it. |
# MAGIC | `05_pgvector` | Installs pgvector, builds an hnsw index, and runs a nearest-neighbour query. |
# MAGIC | `06_register_in_unity_catalog` | Registers the database as a Unity Catalog catalog (Beta) and queries it from a serverless SQL warehouse. |
# MAGIC | `07_cleanup` | Removes what the notebooks created. Does nothing unless `cleanup` is `delete`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Deploy the bundle, then run the job `capability-guides-lakebase-apps` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Notebook 01 must run first, because the others read the `orders` table it creates.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog`, `schema` | Where the Delta tables go. The schema is shared with the other guides, and every table here starts with `lakebase_` or `lb_`. |
# MAGIC | `lakebase_project` | Lakebase project ID created by the bundle. |
# MAGIC | `warehouse_id` | Serverless SQL warehouse that queries the registered catalog. |
# MAGIC | `app_schema` | Postgres schema for the app-owned tables. |
# MAGIC | `dev_branch` | ID of the dev branch that notebook 04 creates. |
# MAGIC | `lakebase_catalog` | Unity Catalog catalog that notebook 06 registers. |
# MAGIC | `cleanup` | `keep` (default) or `delete`. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params, JOB_TAG
JOB_KEY = "capability_guides_lakebase_apps"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'lakebase_project'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
