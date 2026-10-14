"""Write the capability table: GA vs preview status, region, protocol version, and measured latency."""

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
from databricks.sdk.runtime import spark
from pyspark.sql import functions as F


def first(table: str, expr: str):
    rows = spark.sql(f"SELECT {expr} AS v FROM {ac.qualified(args.catalog, args.schema, table)}").collect()
    return rows[0]["v"] if rows else None


def main() -> None:
    spec = ac.load_spec(args.spec)
    w = WorkspaceClient()
    region = w.metastores.get(w.metastores.current().metastore_id).region or "unreported"
    mcp_protocol = first("mcp_tool_call", "protocol_version")
    mcp_p50 = first("mcp_tool_call", "call_p50_ms")
    handoff_ms = first("agent_handoff_trace", "sum(latency_ms)")
    gw_p50 = {
        r["service"]: r["p50"]
        for r in spark.sql(
            f"SELECT service, percentile(latency_ms, 0.5) AS p50 FROM {ac.qualified(args.catalog, args.schema, 'gateway_comparison')} WHERE status = 200 GROUP BY service"
        ).collect()
    }
    burst = {r["status"]: r["n"] for r in spark.sql(
        f"SELECT status, count(*) AS n FROM {ac.qualified(args.catalog, args.schema, 'gateway_burst')} GROUP BY status").collect()}
    gw_rows = spark.table(ac.qualified(args.catalog, args.schema, "gateway_audit_counts")).collect()
    seen = {r["source"]: r["rows_seen"] for r in gw_rows}

    outcome = {
        "uc_function_mcp": ("Worked", f"initialize, tools/list, tools/call over OAuth; protocol {mcp_protocol}", mcp_protocol, mcp_p50),
        "unity_gateway": ("Worked", "Two services, primary plus fallback each; same prompt to both", "OpenAI-compatible chat completions",
                          round(sum(gw_p50.values()) / max(1, len(gw_p50)), 1)),
        "rate_limits": ("Worked" if 429 in burst else "Configured, not observed", f"Burst of {sum(burst.values())} requests: {burst}", "HTTP 429", None),
        "inference_tables": ("Worked" if any(v for k, v in seen.items() if k.startswith("agents_")) else "Configured, no rows yet",
                             "One *_payload table per service in the guide schema", "Delta", None),
        "usage_system_table": ("Worked" if seen.get("system.ai_gateway.usage") else "Queried, no rows yet",
                               f"Rows for these services since the job started: {seen.get('system.ai_gateway.usage')}", "SQL", None),
        "service_policies": ("Not attached by the job", "Beta; attach built-in guardrails in the Unity Gateway UI (Policies tab)", "n/a", None),
        "a2a": ("Not available", "Supervisor handoff used instead; see agent_handoff_trace", "n/a", handoff_ms),
        "model_serving_agents": ("Used in the build guide", "Still works; new agents should target Agent Runtime", "n/a", None),
    }
    rows = []
    for cap in spec["capabilities"]:
        result, note, protocol, latency = outcome[cap["key"]]
        rows.append((cap["key"], cap["name"], cap["status"], region, protocol, None if latency is None else float(latency), result, note, cap["source"]))
    cols = ["capability", "name", "status", "region", "protocol_version", "latency_ms", "result_in_run", "note", "source"]
    (spark.createDataFrame(rows, "capability string, name string, status string, region string, protocol_version string, latency_ms double, result_in_run string, note string, source string")
        .withColumn("recorded_at", F.current_timestamp())
        .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(ac.qualified(args.catalog, args.schema, "agent_capability_matrix")))
    spark.table(ac.qualified(args.catalog, args.schema, "agent_capability_matrix")).drop("source").show(truncate=60)


main()
