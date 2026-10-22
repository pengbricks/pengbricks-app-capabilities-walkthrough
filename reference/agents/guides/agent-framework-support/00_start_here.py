# Databricks notebook source
# MAGIC %md
# MAGIC # Agents, MCP, and model gateway
# MAGIC
# MAGIC This guide runs four checks on a Databricks workspace. A Python client calls a Unity Catalog function as an MCP tool with an OAuth token. A supervisor agent hands the result to a second agent. The same prompt goes through two Unity Gateway model services that carry rate limits, a fallback model and inference tables. A capability table then records each feature's status, protocol and measured latency, including the ones the workspace did not have.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_prepare_tool` | Creates the sample orders, the email mask and the `order_status` function. |
# MAGIC | `02_mcp_tool_call` | Calls the function through the managed MCP server and records the result, latency and grants. |
# MAGIC | `03_agent_handoff` | Runs a supervisor that hands work to an orders agent (MCP tool call) and a policy agent. |
# MAGIC | `04_gateway_routing` | Recreates two gateway model services, sends one prompt to both, and bursts one past its rate limit. |
# MAGIC | `05_gateway_audit` | Reads the inference tables and `system.ai_gateway.usage`, which lag the calls. |
# MAGIC | `06_capability_matrix` | Writes `agent_capability_matrix`. |
# MAGIC | `07_teardown` | Deletes the agent serving endpoint and the gateway services. It belongs to the job `capability-guides-agent-teardown`, which this guide and the build guide share. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-agent-gateway` (or **Quick run** in the app), then `capability-guides-agent-teardown` when you are done. To run by hand, open `01` to `06` in order and use Run all in each. Finish with `07` so no endpoint or gateway service is left running.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema, the tool and the registered agent. |
# MAGIC | `schema` | Schema for the sample data, the tool, the agent model and the record tables. |
# MAGIC | `use_case` | Spec under `use_cases/` with the data, the tool, the agents and the gateway services. |
# MAGIC | `delete_gateway_services` | `07` only. Set to `false` to keep the gateway services. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: this notebook only reads and links the deployed job.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle.** Deploy `reference/foundation` first. It creates the shared schema this guide writes to.
# MAGIC 2. **Managed MCP server (Public Preview).** `02_mcp_tool_call` and `03_agent_handoff` call the managed MCP server for Unity Catalog functions. A workspace admin turns on **Managed MCP Servers** on the workspace **Previews** page. Without it the task stops with an HTTP error before it records anything.
# MAGIC 3. **Unity Gateway model services.** `04_gateway_routing` creates two model services in `<catalog>.<schema>`. Creating a model service needs `CREATE SERVICE` on the schema. `CREATE TABLE` covers the inference table and `CREATE FUNCTION` covers `order_status`. The identity also needs `EXECUTE` on each model a service references (check the docs for your workspace for the default on `system.ai`):
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE SERVICE, CREATE TABLE, CREATE FUNCTION ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC    The primary and fallback models are the pay-per-token endpoints `system.ai.claude-haiku-5-5`, `system.ai.gpt-5-4-mini` and `system.ai.gpt-5-4-nano`. They must be available in the workspace region. List what is there with `databricks serving-endpoints list`.
# MAGIC 4. **Usage system table.** `05_gateway_audit` reads `system.ai_gateway.usage`. A metastore admin enables the schema if it is off, then grants read access:
# MAGIC    ```bash
# MAGIC    databricks system-schemas enable <metastore-id> ai_gateway   # get the ID from: databricks metastores current
# MAGIC    ```
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.ai_gateway TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.ai_gateway.usage TO `<principal>`;
# MAGIC    ```
# MAGIC    Rows can arrive late (about 30 minutes after the calls in the recorded run), so the first run can record zero. The task stops before it changes anything if the table is unreadable.
# MAGIC 5. **Tool access for other callers.** The job identity owns the `order_status` function, so it can call it. Anyone else who calls the tool through MCP needs:
# MAGIC    ```sql
# MAGIC    GRANT EXECUTE ON FUNCTION <catalog>.<schema>.order_status TO `<principal>`;
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_agent_gateway"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == "capability_guides_agent_teardown":
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')
displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
