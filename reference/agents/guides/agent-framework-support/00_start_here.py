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
