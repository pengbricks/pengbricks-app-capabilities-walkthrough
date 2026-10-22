# Genie and Databricks MCP with outside assistants

## Overview

The job reuses the Genie Agent from the Genie Agents guide (or creates one over the same sample tables), connects to a managed MCP endpoint with the Databricks MCP Python client, lists the tools, asks a question, and prints the answer and the SQL. That is the call ChatGPT, Gemini, Copilot Studio, or Claude Code makes after the user signs in. The `connectors/` folder holds example configuration for each assistant, with `https://<workspace-host>` as the placeholder.

## Required setup

Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.

1. **Foundation bundle and SQL warehouse.** Deploy `reference/foundation` first. Use a Pro or serverless SQL warehouse that `<principal>` can use.
2. **Managed MCP status.** The Genie One MCP server (`system.ai.genie_one_mcp`) is generally available since September 25, 2026. The Genie Agent MCP server needs a workspace admin to enable **Managed MCP Servers** on the Previews page (Public Preview since January 27, 2026). The earlier Beta endpoint `/api/2.0/mcp/genie` sunsets October 31, 2026. The Genie Agent page still lists `/api/2.0/mcp/genie/<genie-space-id>` as its Preview URL, so confirm that path on the page before you rely on it past that date.
3. **Permissions.** `<principal>` needs CAN RUN on the Genie Agent, SELECT on its tables, and `USE CATALOG`, `USE SCHEMA`, `CREATE TABLE` on the guide schema. For `genie_one`, callers also need EXECUTE on the MCP and USE on its catalog and schema.
4. **OAuth app connection (account admin).** Only the outside assistants need it, not the job. An account admin adds a connection in the account console under **Settings**, **App connections**, with the client's redirect URL and the `ai-gateway` scope (Genie One) or `genie` scope (Genie Agent endpoint). Nothing in this bundle creates it.
5. **Teams app (Microsoft 365 admin).** An account admin enables **Databricks Genie for Microsoft Teams** on the account Previews page. A Microsoft 365 admin installs **Databricks Genie** and approves its permissions.
6. **System tables (optional).** Grant `SELECT` on `system.query.history` (Genie Agent endpoint) or `system.ai_gateway.usage` (Genie One) for the audit step.

## What this shows

| Capability | Artifact |
|---|---|
| Reuse or create the agent | `01_genie_agent_for_mcp`: `pick_reusable_space` over the Genie Agents guide's agent, this guide's own, or a new one |
| Endpoint URLs and scopes | `mcp_url` and `oauth_scope` in `src/mcp_lib.py` |
| The call an assistant makes | `02_call_mcp_from_python`: `DatabricksMCPClient.list_tools()` and `call_tool()` |
| Tool discovery without hardcoded names | `classify_tools`, `ask_arguments`, `follow_up_arguments` |
| Answer and SQL from the reply | `extract_sql`, `extract_answer`, `poll_until_done` |
| Audit of the outside call | `audit_sql` (`system.query.history`) and `gateway_usage_sql` (`system.ai_gateway.usage`) |
| Per-assistant setup | `connectors/chatgpt.md`, `gemini-settings.json`, `copilot-studio.md`, `teams.md` |

## Architecture

```mermaid
flowchart LR
  agent[01_genie_agent_for_mcp: reuse or create] --> call[02_call_mcp_from_python]
  call --> list[list_tools]
  list --> ask[ask + poll]
  ask --> out[answer + SQL]
  call --> audit[system tables]
  agent --> res[(genie_external_ai_results)]
  call --> res
```

## Reference code

- `guides/genie-external-ai/01_genie_agent_for_mcp`: finds or creates the agent, records both endpoint URLs
- `guides/genie-external-ai/02_call_mcp_from_python`: the MCP client call, answer, SQL, audit
- `guides/genie-external-ai/connectors/`: example files for the outside assistants
- `src/mcp_lib.py`: URLs, tool discovery, reply parsing, polling, results rows
- `resources/genie_external_ai.job.yml`: the two-task job

## Demo steps

1. Open the latest `capability-guides-genie-external-ai` run and its two tasks.
2. Read the results:
   ```sql
   SELECT step, item, value FROM <catalog>.<schema>.genie_external_ai_results ORDER BY step, item;
   ```
3. Set `mcp_server` to `genie_agent` and run again to compare the two endpoints. The job defaults to `genie_one`, the generally available server.
4. Copy a file from `connectors/`, replace `<workspace-host>`, and connect the assistant. Sign in as a user who has no access to a table and ask about it.
5. Find the statements:
   ```sql
   SELECT executed_by, executed_as, client_application FROM system.query.history WHERE query_source.genie_space_id = '<space id>';
   ```

## Artifacts produced

- Tables: `genie_external_ai_results` (replaced per step on each run), a `genie-external-ai` row in `genie_spaces`, and the shared sample tables and `sales_metrics` metric view when no agent exists to reuse
- A Genie Agent, only when none could be reused
- Idle cost: none. The agent and tables cost nothing while idle, and the SQL warehouse follows its own auto-stop. To remove the agent, delete it in the UI and its row in `genie_spaces`.

## Limitations and next steps

- The job runs as its run-as identity, not as a person. The per-user sign-in an assistant uses is tested by hand with the connector files.
- The public docs do not list tool names for the Genie Agent MCP server or the reply format, so the notebook reads them from `tools/list` and parses the reply. Check the printed tool list in the first run.
- Next: add a row filter on a sample table and ask the same question as two users.
