# Databricks notebook source
# MAGIC %md
# MAGIC # Compute and capacity management
# MAGIC
# MAGIC This guide reads warehouse settings, creates a temporary 2X-Small test warehouse, loads it with concurrent statements so it queues, reads the queueing back from system tables, and deletes the test warehouse.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_read_settings` | Reads every warehouse's settings and creates the workspace-scoped system-table views. |
# MAGIC | `02_create_load_warehouse` | Creates the temporary test warehouse. |
# MAGIC | `03_generate_load` | Submits concurrent heavy statements and waits for them. |
# MAGIC | `04_analyze_load` | Reads wait times and warehouse events from system tables. |
# MAGIC | `05_delete_load_warehouse` | Deletes the test warehouse. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-compute-capacity` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each, and always finish with `05` so no test warehouse is left behind. `04` can take several minutes because `system.query.history` lags.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for this guide's tables. |
# MAGIC | `warehouse_id` | The shared warehouse whose settings are recorded as the target. |
# MAGIC | `queries` | How many concurrent statements `03` submits. |
# MAGIC | `range_rows` | Rows each statement scans. Raise it to lengthen the load. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_compute_capacity"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'warehouse_id', 'queries', 'range_rows'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
