# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt databricks-mcp "mcp>=1.24,<2"

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Call the managed MCP endpoint from Python
# MAGIC
# MAGIC This is the call an outside assistant makes. The notebook connects to the Genie Agent MCP server (or the Genie One MCP server) with the Databricks MCP Python client, lists the tools the endpoint offers, sends one question, polls until the answer is final, and prints the answer and the SQL.
# MAGIC
# MAGIC The Genie Agent MCP server needs the Managed MCP Servers preview on the workspace, and its public docs do not list tool names, so the notebook picks the ask and poll tools from the `tools/list` response. The Genie One MCP server is generally available and its tools are `genie_ask`, `genie_poll_response`, and `genie_get_query_result`. Genie One routes the question to an agent the caller can use, so its answer may come from another agent.
# MAGIC
# MAGIC The job runs this as the job's run-as identity. An assistant signs in as the person instead, through OAuth, and Unity Catalog then checks that person.
# MAGIC
# MAGIC Safe to rerun, in a notebook or as a job task: the call is read-only, and this step's rows in `genie_external_ai_results` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_genie_external_ai", ['catalog', 'schema', 'mcp_server', 'mcp_question', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]
base = f"{catalog}.{schema}"

from datetime import datetime, timedelta, timezone
from databricks.sdk import WorkspaceClient
from databricks_mcp import DatabricksMCPClient
from mcp_lib import (
    GUIDE, SERVERS, ask_arguments, audit_sql, call_sync, classify_tools, content_text, extract_answer, extract_ids, extract_sql,
    extract_status, follow_up_arguments, gateway_usage_sql, mcp_url, oauth_scope, poll_until_done, result_row, tool_field, write_rows,
)

server = params["mcp_server"]
if server not in SERVERS:
    raise ValueError(f"mcp_server must be one of {SERVERS}")
w = WorkspaceClient()
space_id = spark.sql(f"SELECT space_id FROM {base}.genie_spaces WHERE guide = '{GUIDE}' AND role = 'agent'").first()["space_id"]
url = mcp_url(server, w.config.host, space_id if server == "genie_agent" else "")
print(server, url, "(OAuth scope:", oauth_scope(server) + ")")
rows = [result_row(run_id, "call", "endpoint", server, f"scope {oauth_scope(server)}")]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Connect and list the tools
# MAGIC
# MAGIC `DatabricksMCPClient` takes the server URL and a `WorkspaceClient`. `list_tools()` returns the tools the caller is allowed to see. The client runs `asyncio.run` inside each call, and a notebook already has a running event loop, so `call_sync` runs each client call in a worker thread.

# COMMAND ----------

mcp = DatabricksMCPClient(server_url=url, workspace_client=w)
tools = call_sync(mcp.list_tools)
for tool in tools:
    print(f"- {tool_field(tool, 'name')}: {(tool_field(tool, 'description') or '')[:100]}")
picked = classify_tools(tools)
by_name = {tool_field(tool, "name"): tool for tool in tools}
rows.append(result_row(run_id, "call", "tools", ", ".join(by_name), f"{len(tools)} tool(s) from tools/list"))
rows.append(result_row(run_id, "call", "picked_tools", picked, "ask, poll, and result tools chosen by name"))
if not picked["ask"]:
    write_rows(spark, base, "call", rows)
    raise RuntimeError(f"No ask tool among {list(by_name)}. Check that Managed MCP Servers is on and the caller can use the agent.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Ask the question and wait for the answer
# MAGIC
# MAGIC The ask tool returns IDs and a status. The notebook then calls the poll tool one call at a time until the status is final.

# COMMAND ----------

started = datetime.now(timezone.utc) - timedelta(seconds=30)  # margin for clock skew when matching query history
question = params["mcp_question"]
reply = content_text(call_sync(mcp.call_tool, picked["ask"], ask_arguments(by_name[picked["ask"]], question)))
ids = extract_ids(reply)
status = extract_status(reply)
print("ask reply status:", status, ids)

if picked["poll"] and ids:
    poll_args = follow_up_arguments(by_name[picked["poll"]], ids)
    reply, polls = poll_until_done(lambda: content_text(call_sync(mcp.call_tool, picked["poll"], poll_args)), attempts=40, pause_seconds=5)
    status = extract_status(reply)
    rows.append(result_row(run_id, "call", "polls", polls, "poll calls made, one at a time"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The answer and the SQL

# COMMAND ----------

sql, answer = extract_sql(reply), extract_answer(reply)
print("Status:", status)
print("\nQuestion:", question)
print("\nAnswer:", answer or "(no prose in the reply)")
print("\nSQL:\n" + (sql or "(no SQL in the reply)"))
rows += [
    result_row(run_id, "call", "question", question),
    result_row(run_id, "call", "status", status),
    result_row(run_id, "call", "answer", answer[:1000], "prose part of the reply"),
    result_row(run_id, "call", "sql", (sql or "")[:3000], "SQL Genie generated"),
]
write_rows(spark, base, "call", rows)
if status not in {"COMPLETED"}:
    raise RuntimeError(f"The MCP call ended with status {status}. See genie_external_ai_results for the reply.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find the call in the audit tables
# MAGIC
# MAGIC The Genie Agent endpoint skips Unity Gateway, so its statements show in `system.query.history` with the asking identity (system tables can lag by minutes). The Genie One endpoint writes to `system.ai_gateway.usage`. Both reads are best effort and never fail the job: the identity may not have the system-table grants.

# COMMAND ----------

from agent_results import wait_for_rows

audit = []
try:
    if server == "genie_agent":
        fetch = lambda: spark.sql(audit_sql(space_id, started.isoformat())).collect()
        found, polls = wait_for_rows(fetch, minimum=1, attempts=12, pause_seconds=20)
        for row in found:
            print(row.asDict())
        audit.append(result_row(run_id, "audit", "query_history_statements", len(found), f"system.query.history, {polls} poll(s)"))
        if found:
            audit.append(result_row(run_id, "audit", "executed_as", ", ".join(sorted({str(r['executed_as']) for r in found})), "identity the statements ran as"))
    else:
        found = spark.sql(gateway_usage_sql()).collect()
        for row in found:
            print(row.asDict())
        audit.append(result_row(run_id, "audit", "gateway_tool_calls", sum(r["calls"] for r in found), "system.ai_gateway.usage, all time for this MCP"))
except Exception as error:
    audit.append(result_row(run_id, "audit", "unavailable", type(error).__name__, str(error)[:200]))
    print("audit query skipped:", str(error)[:200])
write_rows(spark, base, "audit", audit)
