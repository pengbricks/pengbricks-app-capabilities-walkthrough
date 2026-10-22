# Databricks notebook source
# MAGIC %md
# MAGIC # Assistant user experience
# MAGIC
# MAGIC This guide creates a Genie space over the governed metric view and runs a scripted user session against it through the Conversation API: discovery, a first question, a follow-up, a refinement, an ambiguous question, and thumbs feedback. Each task is logged with its outcome, any issue found, and the training need it points to.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_prepare_data` | Creates the sample tables from the use-case spec if they do not exist. Existing tables are kept. |
# MAGIC | `02_prepare_semantics` | Adds table and column comments, tags, and the `sales_metrics` metric view. |
# MAGIC | `03_run_user_session` | Updates the assistant Genie space in place by title, runs the scripted session, and writes `ux_session_log`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-genie-ux` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. The session takes several minutes: Genie answers one message at a time.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the sample tables, metric view and session log. |
# MAGIC | `use_case` | Spec under `use_cases/` with the tables, space text and the user script. |
# MAGIC | `warehouse_id` | SQL warehouse the Genie space uses to run queries. |
# MAGIC | `run_id` | Set by the job on `03_run_user_session`. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: tables are kept, the space is updated in place by title, earlier conversations are deleted, and the session log is replaced.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle.** Deploy `reference/foundation` first. It creates the shared schema this guide writes to.
# MAGIC 2. **SQL warehouse.** Genie runs its queries on the warehouse in the `warehouse_id` variable. It must be a Pro or serverless warehouse, and `<principal>` needs CAN USE on it. Create one if you have none:
# MAGIC    ```bash
# MAGIC    databricks warehouses create --name genie-guides --cluster-size 2X-Small --warehouse-type PRO --enable-serverless-compute
# MAGIC    ```
# MAGIC 3. **Genie space creation.** The job creates Genie spaces through the REST API. `<principal>` needs access to Databricks SQL and the right to create spaces, and Databricks Assistant must be enabled for the workspace.
# MAGIC 4. **Schema privileges.** The job creates the sample tables, comments, tags and the `sales_metrics` metric view:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, SELECT, APPLY TAG ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_genie_ux"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'warehouse_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
