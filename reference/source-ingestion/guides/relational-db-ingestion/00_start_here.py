# Databricks notebook source
# MAGIC %md
# MAGIC # Relational database ingestion
# MAGIC
# MAGIC This guide builds a source database in Lakebase Postgres, exposes it through a Unity Catalog connection, lands full tables and a custom SQL result with `remote_query`, and compares each landed table with the source by row count, checksum and column types. Safe to rerun: the source schema is rebuilt, the connection is reused, landed tables are overwritten, and only the extract log and check tables grow, by one set of rows per run.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_create_source` | Creates the source schema, tables and the `net_amount` database function in Postgres and loads sample rows. |
# MAGIC | `02_setup_federation` | Creates or refreshes the Unity Catalog connection and tries to create a foreign catalog. |
# MAGIC | `03_extract` | Lands `rel_customers`, `rel_orders` and `rel_customer_revenue` with `remote_query`. |
# MAGIC | `04_compare_with_source` | Compares counts, checksums and types with the same queries run in Postgres. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-relational-extract` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the `source_landing` volume. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the data, sources and checks. |
# MAGIC | `lakebase_project` | Lakebase Postgres project that hosts the source database. Overrides `lakebase_project` in the use-case spec. |
# MAGIC | `run_id` | Set by the job on the notebooks that log results. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_relational_extract"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
