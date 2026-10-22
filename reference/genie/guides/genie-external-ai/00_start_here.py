# Databricks notebook source
# MAGIC %md
# MAGIC # Genie and Databricks MCP with ChatGPT, Gemini, and Copilot
# MAGIC
# MAGIC This guide runs the call an outside assistant makes. It reuses or creates a Genie Agent over the sample sales tables, connects to the managed MCP endpoint with the Databricks MCP Python client, lists the tools, asks a question, and prints the answer and the SQL. The `connectors/` folder holds example configuration for ChatGPT, Gemini CLI, Copilot Studio, and the Teams app.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_genie_agent_for_mcp` | Reuses the agent from the Genie Agents guide, or this guide's agent from an earlier run. If neither exists, creates the sample tables, the `sales_metrics` metric view, and an agent. Records the two MCP endpoint URLs. |
# MAGIC | `02_call_mcp_from_python` | Connects to the endpoint chosen by `mcp_server`, lists tools, asks `mcp_question`, polls until the answer is final, and prints the answer and SQL. Reads the audit tables, best effort. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-genie-external-ai` (or **Quick run** in the app). By hand, open the notebooks in order and use Run all in each. Test the connector files by hand against your own workspace host, since they need a person to sign in.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the sample tables, metric view, and results table. |
# MAGIC | `use_case` | Spec under `use_cases/` with the tables and the `genie_agent` block. |
# MAGIC | `warehouse_id` | SQL warehouse the agent uses to run queries. |
# MAGIC | `mcp_server` | `genie_one` (default, generally available) or `genie_agent` (per-agent endpoint, Preview on the Genie Agent MCP page). |
# MAGIC | `mcp_question` | The question sent through the endpoint. |
# MAGIC | `run_id` | Set by the job on both tasks. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name.
# MAGIC
# MAGIC Safe to rerun: the agent is reused or updated by title, the MCP call is read-only, and each step replaces its own rows in `genie_external_ai_results`.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle and SQL warehouse.** Deploy `reference/foundation` first, and use a Pro or serverless SQL warehouse that `<principal>` can use, as in the Genie Agents guide.
# MAGIC 2. **Managed MCP status.** The Genie One MCP server (`system.ai.genie_one_mcp`) is generally available since September 25, 2026. The Genie Agent MCP server needs a workspace admin to enable **Managed MCP Servers** on the workspace Previews page (Public Preview since January 27, 2026). Without it, `02_call_mcp_from_python` stops at the tool listing when `mcp_server` is `genie_agent`. The default, `genie_one`, does not need it.
# MAGIC 3. **Permissions on the agent and the tables.** `<principal>` needs CAN RUN on the Genie Agent and SELECT on its tables, plus the schema privileges from the Genie Agents guide:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE TABLE, SELECT ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC    For `genie_one`, callers also need EXECUTE on the MCP and USE CATALOG and USE SCHEMA on its catalog and schema, which is `system.ai` for the Databricks-provided server.
# MAGIC 4. **OAuth app connection for outside clients (account admin).** The job does not need one. ChatGPT, Gemini, and Claude Code do, because Databricks MCP endpoints do not support dynamic client registration. In the account console, an account admin opens **Settings**, **App connections**, **Add connection**, enters the client's redirect URL, and picks the scope (`ai-gateway` for Genie One, `genie` for the Genie Agent endpoint). This notebook never creates one. Changes take up to 30 minutes.
# MAGIC 5. **Teams app (Microsoft 365 admin).** An account admin enables **Databricks Genie for Microsoft Teams** on the account console Previews page, and a Microsoft 365 admin installs **Databricks Genie** from the Microsoft marketplace and approves its permissions.
# MAGIC 6. **System tables (optional).** The audit step reads `system.query.history` for `genie_agent` and `system.ai_gateway.usage` for `genie_one`. A metastore admin enables the schemas and grants `SELECT` to `<principal>`. If the grants are missing, the step records `unavailable` and the job still passes.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params, JOB_TAG
JOB_KEY = "capability_guides_genie_external_ai"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'warehouse_id', 'mcp_server', 'mcp_question'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
