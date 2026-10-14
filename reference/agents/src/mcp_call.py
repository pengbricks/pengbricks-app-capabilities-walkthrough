"""Call one Unity Catalog function as an MCP tool and record the call.

The call goes to the managed MCP server for the schema with an OAuth token from the Databricks SDK, so
Unity Catalog checks the caller's grants. Records tools/list, the tool result, UC grants, and latency.
"""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import agents_common as ac
from databricks.sdk import WorkspaceClient
from databricks.sdk.runtime import dbutils, spark
from pyspark.sql import functions as F


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


main()
