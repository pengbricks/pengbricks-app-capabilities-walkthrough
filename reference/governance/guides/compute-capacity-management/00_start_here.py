# Databricks notebook source
# MAGIC %md
# MAGIC # Compute and capacity management
# MAGIC
# MAGIC This guide reads warehouse settings, creates a temporary 2X-Small test warehouse, loads it with concurrent statements so it queues, reads the queueing back from system tables, and deletes the test warehouse. A last read-only task audits the type of every warehouse.
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
# MAGIC | `06_warehouse_type_audit` | Lists every warehouse with its type, flags those that are not serverless or stop late, and writes `governance_warehouse_types`. Read only. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-compute-capacity` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each, always finish with `05` so no test warehouse is left behind, and run `06` any time (it only reads). `04` can take several minutes because `system.query.history` lags.
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

# MAGIC
# MAGIC Safe to rerun: it only reads the deployed job and links to it.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal that runs `databricks bundle run`.
# MAGIC
# MAGIC 1. **System tables for the load analysis and the dashboard.** The job and the dashboard read `system.query.history` and `system.compute.warehouse_events`. A metastore admin or account admin enables the schemas if they are off, then grants read access:
# MAGIC    ```bash
# MAGIC    databricks metastores current   # shows the metastore ID
# MAGIC    databricks system-schemas enable <metastore-id> query
# MAGIC    databricks system-schemas enable <metastore-id> compute
# MAGIC    ```
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.query TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.query.history TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.compute TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.compute.warehouse_events TO `<principal>`;
# MAGIC    ```
# MAGIC    Without them `01_read_settings` stops before it changes anything.
# MAGIC 2. **Rights to create a SQL warehouse.** `02_create_load_warehouse` creates a 2X-Small serverless warehouse named `capability-guides-capacity-test`, and `05_delete_load_warehouse` deletes it. `<principal>` must be a workspace admin or hold the **Allow unrestricted cluster creation** entitlement, and the workspace must allow serverless SQL warehouses. To check, create and delete a throwaway warehouse:
# MAGIC    ```bash
# MAGIC    databricks warehouses create --name capacity-setup-check --cluster-size 2X-Small --min-num-clusters 1 --max-num-clusters 1 --auto-stop-mins 5 --enable-serverless-compute --warehouse-type PRO
# MAGIC    databricks warehouses delete <warehouse-id>
# MAGIC    ```

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
