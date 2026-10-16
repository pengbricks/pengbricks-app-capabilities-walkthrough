# Databricks notebook source
# MAGIC %md
# MAGIC # Lineage and drift detection
# MAGIC
# MAGIC This guide builds a source, silver and gold table chain, reads its lineage back from Unity Catalog system tables, detects a schema change from table history, and flags a distribution shift between two batches of data.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_build_chain` | Builds `obs_source_orders`, `obs_silver_orders` and `obs_gold_daily_revenue` with SQL, so Unity Catalog records lineage. |
# MAGIC | `02_read_lineage` | Polls `system.access.table_lineage` until the chain shows up, walks upstream from gold, then reads `column_lineage`. Lineage can take several minutes to land. |
# MAGIC | `03_detect_schema_drift` | Adds a column and widens a type on the silver table, then detects both from `information_schema` snapshots and `DESCRIBE HISTORY`. |
# MAGIC | `04_detect_data_drift` | Writes a baseline batch, creates a data profiling monitor, appends a shifted batch, and computes PSI and mean shift. The job runs it at the same time as `01`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-observability` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. `04` does not depend on the others.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables. |
# MAGIC | `use_case` | Spec under `use_cases/` with the sample data, drift thresholds and schema changes. |
# MAGIC | `run_id` | Set by the job. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_observability"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
