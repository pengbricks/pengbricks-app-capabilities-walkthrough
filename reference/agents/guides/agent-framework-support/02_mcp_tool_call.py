# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Call the tool over MCP
# MAGIC
# MAGIC Call one Unity Catalog function as an MCP tool and record the call.
# MAGIC
# MAGIC The call goes to the managed MCP server for the schema with an OAuth token from the Databricks SDK, so
# MAGIC Unity Catalog checks the caller's grants. Records tools/list, the tool result, UC grants, and latency.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_agent_gateway", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

from types import SimpleNamespace
args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    src_dir=str(bundle_root() / "src"),
    spec=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
)

import sys
import agents_common as ac
from databricks.sdk import WorkspaceClient
from pyspark.sql import functions as F

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def main() -> None:
    spec = ac.load_spec(args.spec)
    tool = spec["tool"]
    w = WorkspaceClient()
    headers = w.config.authenticate()
    url = ac.mcp_url(w.config.host, args.catalog, args.schema)
    fn = ac.qualified(args.catalog, args.schema, tool["function"])
    tool_name = ac.mcp_tool_name(args.catalog, args.schema, tool["function"])

    init, init_ms = ac.mcp_rpc(
        url, headers, "initialize",
        {"protocolVersion": ac.MCP_PROTOCOL_VERSION, "capabilities": {}, "clientInfo": {"name": "capability-guide", "version": "1"}},
    )
    protocol = init.get("result", {}).get("protocolVersion", "unreported")
    listing, list_ms = ac.mcp_rpc(url, headers, "tools/list", rid=2)
    names = [t["name"] for t in listing["result"]["tools"]]
    assert tool_name in names, f"{tool_name} not listed: {names}"

    call_ms = []
    for i in range(3):
        result, ms = ac.mcp_rpc(
            url, headers, "tools/call", {"name": tool_name, "arguments": {tool["parameter"]: tool["sample_order_id"]}}, rid=10 + i
        )
        call_ms.append(ms)
    text = ac.tool_result_text(result)
    assert "ERROR" not in text and "status=" in text, text

    grants = spark.sql(f"SHOW GRANTS ON FUNCTION {fn}").collect()
    caller = w.current_user.me().user_name
    lat = ac.summarize_latency(call_ms)
    print(f"caller={caller} protocol={protocol}\ntool result: {text}\nlatency: {lat}")

    rows = [
        (caller, tool_name, url.replace(w.config.host, "<workspace>"), protocol, len(names), text, lat["p50_ms"], lat["max_ms"],
         round(init_ms, 1), round(list_ms, 1), "; ".join(f"{g['Principal']}:{g['ActionType']}" for g in grants)),
    ]
    cols = ["caller", "tool", "mcp_url", "protocol_version", "tools_listed", "result", "call_p50_ms", "call_max_ms",
            "initialize_ms", "list_ms", "function_grants"]
    (spark.createDataFrame(rows, cols).withColumn("recorded_at", F.current_timestamp())
        .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(ac.qualified(args.catalog, args.schema, "mcp_tool_call")))
    dbutils.jobs.taskValues.set(key="protocol_version", value=protocol)
    dbutils.jobs.taskValues.set(key="call_p50_ms", value=lat["p50_ms"])

# COMMAND ----------

main()
