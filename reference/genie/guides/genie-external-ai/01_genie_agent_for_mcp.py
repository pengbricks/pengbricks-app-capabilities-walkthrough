# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. A Genie Agent for the MCP endpoint
# MAGIC
# MAGIC An outside assistant reaches a Genie Agent through an MCP endpoint, so the agent has to exist first. This notebook reuses the agent that the Genie Agents guide registered in `genie_spaces`, or the one this guide made on an earlier run, when it still exists. Otherwise it creates the sample tables and the `sales_metrics` metric view if they are missing, and creates an agent over them from the spec's `genie_agent` block.
# MAGIC
# MAGIC Safe to rerun: existing tables are kept, the metric view is replaced, an existing agent is reused or updated by title, and this guide's rows in `genie_spaces` and `genie_external_ai_results` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_genie_external_ai", ['catalog', 'schema', 'use_case', 'warehouse_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]
base = f"{catalog}.{schema}"

from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from genie_lib import GenieClient, build_agent_space, load_spec, register_space
from mcp_lib import GUIDE, mcp_url, pick_reusable_space, result_row, write_rows

spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
w = WorkspaceClient()
client = GenieClient(w)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find an agent to reuse
# MAGIC
# MAGIC Candidates, in order: the agent from the Genie Agents guide, then this guide's own agent from an earlier run. A candidate counts only if the agent still exists.

# COMMAND ----------

def registered(guide: str) -> str | None:
    if not spark.catalog.tableExists(f"{base}.genie_spaces"):
        return None
    row = spark.sql(f"SELECT space_id FROM {base}.genie_spaces WHERE guide = '{guide}' AND role = 'agent'").first()
    return row["space_id"] if row else None

def exists(space_id: str | None) -> bool:
    if not space_id:
        return False
    try:
        client.get_space(space_id)
        return True
    except Exception as error:  # a deleted agent answers with an error; anything else is reported
        print(f"agent {space_id} is not usable: {str(error)[:120]}")
        return False

candidates = [(space_id, exists(space_id)) for space_id in (registered("genie-agents"), registered(GUIDE)) if space_id]
space_id = pick_reusable_space(candidates)
print("reusing", space_id) if space_id else print("no agent to reuse, creating one")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the data and the agent when nothing can be reused

# COMMAND ----------

from setup_data import generate_tables
from apply_semantics import apply_semantics

agent = spec["genie_agent"]
title = f"{spec['space_prefix']} (MCP) [{schema}]"
if space_id is None:
    generate_tables(spark, spec, catalog, schema, recreate=False)
    apply_semantics(spark, spec, catalog, schema)
    space_id = client.upsert_space(title, agent["description"], params["warehouse_id"], build_agent_space(agent, catalog, schema))
    origin = "created"
else:
    origin = "reused"
url = client.space_url(space_id)
print(f"Genie Agent {space_id} ({origin})\n{url}")
register_space(spark, base, "genie_spaces", (run_id, GUIDE, "agent", space_id, url, title, datetime.now(timezone.utc).isoformat()))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the endpoints an assistant would use
# MAGIC
# MAGIC The Genie Agent MCP server takes the agent ID in the URL. The Genie One MCP server takes none. Both URLs use the workspace host, so use the same host in the connector files.

# COMMAND ----------

host = w.config.host
stored = client.get_space(space_id)
rows = [
    result_row(run_id, "agent", "space_id", space_id, origin),
    result_row(run_id, "agent", "title", stored.get("title"), "title of the agent that the MCP endpoint serves"),
    result_row(run_id, "agent", "warehouse_id", stored.get("warehouse_id"), "SQL warehouse the agent runs on"),
    result_row(run_id, "agent", "genie_agent_mcp_url", mcp_url("genie_agent", host, space_id), "preview, OAuth scope genie, skips Unity Gateway"),
    result_row(run_id, "agent", "genie_one_mcp_url", mcp_url("genie_one", host), "generally available, OAuth scope ai-gateway"),
]
write_rows(spark, base, "agent", rows)
for row in rows:
    print(row[2], "=", row[3])
displayHTML(f'<a href="{url}">Open the agent</a>')
