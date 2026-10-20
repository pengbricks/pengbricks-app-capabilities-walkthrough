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
