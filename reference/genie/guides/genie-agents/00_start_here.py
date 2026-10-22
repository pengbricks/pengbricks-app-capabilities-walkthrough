# Databricks notebook source
# MAGIC %md
# MAGIC # Genie Agents
# MAGIC
# MAGIC This guide builds a Genie Agent over the sales metric view, asks it questions through the Conversation API, and then shows where the work happened: what the agent stores, which identity ran each query, and on which SQL warehouse. Every finding lands in one results table, `genie_agents_results`.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_prepare_data` | Creates the sample tables and the `sales_metrics` metric view if they do not exist. |
# MAGIC | `02_create_agent` | Creates or updates the agent by title through the REST API: one text instruction, example SQL (one parameterized), column settings, sample questions, and benchmarks. Records the warehouse type and what the definition holds. |
# MAGIC | `03_ask_questions` | Deletes this agent's earlier conversations, asks four questions (one a follow-up, one deliberately vague), and sends a thumbs-up on the first answer. |
# MAGIC | `04_read_back` | Reads the conversations and messages back and records which fields the platform stores. |
# MAGIC | `05_find_queries` | Polls `system.query.history` for the statements the agent issued and records who ran them and on which warehouse. Checks `system.billing.usage`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-genie-agents` (or **Quick run** in the app). By hand, open the notebooks in order and use Run all in each. The job takes several minutes: Genie answers one message at a time, and system tables can lag.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the sample tables, metric view, and results table. |
# MAGIC | `use_case` | Spec under `use_cases/` with the tables, the `genie_agent` block, and the questions. |
# MAGIC | `warehouse_id` | SQL warehouse the agent uses to run queries. |
# MAGIC | `run_id` | Set by the job on tasks 02 to 05. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: the agent is found by title and updated in place, earlier conversations are deleted, and each step replaces its own rows in `genie_agents_results`.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle.** Deploy `reference/foundation` first. It creates the shared schema this guide writes to.
# MAGIC 2. **SQL warehouse.** Genie runs its queries on the warehouse in the `warehouse_id` variable. It must be a Pro or serverless warehouse, and `<principal>` needs CAN USE on it. Create one if you have none:
# MAGIC    ```bash
# MAGIC    databricks warehouses create --name genie-agents --cluster-size 2X-Small --warehouse-type PRO --enable-serverless-compute
# MAGIC    ```
# MAGIC 3. **Genie space creation.** `02_create_agent` creates a Genie Agent through the REST API. `<principal>` needs access to Databricks SQL and the right to create spaces, and Databricks Assistant must be enabled for the workspace. The agent runs queries with the credentials of the identity that saved it, so that identity needs the privileges below.
# MAGIC 4. **Schema privileges.** The job creates the sample tables and the `sales_metrics` metric view:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, SELECT ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC 5. **Query history and billing (task 5).** `05_find_queries` reads `system.query.history` and `system.billing.usage`. A metastore admin enables the schemas if they are off, then grants read access:
# MAGIC    ```bash
# MAGIC    databricks system-schemas enable <metastore-id> query     # get the ID from: databricks metastores current
# MAGIC    databricks system-schemas enable <metastore-id> billing
# MAGIC    ```
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.query TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.query.history TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.billing TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.billing.usage TO `<principal>`;
# MAGIC    ```
# MAGIC    The task stops before it changes anything if `system.query.history` is unreadable. A missing billing grant is recorded as `query failed` in the billing rows. Billing rows can take hours to appear.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_genie_agents"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'warehouse_id'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
