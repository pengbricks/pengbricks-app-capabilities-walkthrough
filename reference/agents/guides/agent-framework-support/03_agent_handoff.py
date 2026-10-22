# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Hand off between agents
# MAGIC
# MAGIC Cross-agent handoff: a supervisor hands one task to an orders agent and the result to a policy agent.
# MAGIC
# MAGIC No A2A endpoint exists on the workspace, so the handoff is a supervisor pattern: the supervisor model
# MAGIC calls a `handoff` tool, and each specialist is its own model call with its own prompt and tools. The
# MAGIC orders agent calls the Unity Catalog function over MCP. Every step lands in `agent_handoff_trace`. Safe to rerun: `agent_handoff_trace` is overwritten.

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

import json
import sys
import uuid
import agents_common as ac
from databricks.sdk import WorkspaceClient
from pyspark.sql import functions as F
MAX_STEPS = 6
trace: list[tuple] = []  # (run_id, step, agent, kind, detail, latency_ms)
RUN_ID = uuid.uuid4().hex[:12]
HANDOFF_TOOL = [{
    "type": "function",
    "function": {
        "name": "handoff",
        "description": "Hand a task to a specialist agent and receive its answer.",
        "parameters": {
            "type": "object",
            "properties": {
                "agent": {"type": "string", "enum": ["orders_agent", "policy_agent"]},
                "task": {"type": "string", "description": "Everything the agent needs, as plain text"},
            },
            "required": ["agent", "task"],
        },
    },
}]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record

# COMMAND ----------

def record(agent: str, kind: str, detail: str, ms: float) -> None:
    trace.append((RUN_ID, len(trace) + 1, agent, kind, detail[:1500], round(ms, 1)))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Model call

# COMMAND ----------

def model_call(host, headers, model, messages, tools=None):
    status, body, ms = ac.chat(host, headers, f"system.ai.{model}", messages, tools, max_tokens=2000)
    if status != 200:
        raise RuntimeError(f"{model} returned {status}: {body}")
    return ac.message_of(body), ms

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run orders agent

# COMMAND ----------

def run_orders_agent(host, headers, model, task, mcp_url, mcp_tools, aliases):
    messages = [
        {"role": "system", "content": "You are the orders agent. Use the tool to look up order facts. Reply with the facts only."},
        {"role": "user", "content": task},
    ]
    for _ in range(4):
        msg, ms = model_call(host, headers, model, messages, mcp_tools)
        calls = ac.tool_calls_of(msg)
        if not calls:
            record("orders_agent", "answer", ac.text_of(msg), ms)
            return ac.text_of(msg)
        messages.append(msg)
        for call in calls:
            name, raw = aliases[call["function"]["name"]], call["function"]["arguments"]
            result, tool_ms = ac.mcp_rpc(mcp_url, headers, "tools/call", {"name": name, "arguments": json.loads(raw or "{}")}, rid=99)
            text = ac.tool_result_text(result)
            record("orders_agent", "mcp_tool_call", f"{name}({raw}) -> {text}", tool_ms)
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": text})
    return "orders agent hit its step limit"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run policy agent

# COMMAND ----------

def run_policy_agent(host, headers, model, task, policy_text):
    messages = [
        {"role": "system", "content": f"You are the policy agent. Draft the customer reply. {policy_text}"},
        {"role": "user", "content": task},
    ]
    msg, ms = model_call(host, headers, model, messages)
    record("policy_agent", "answer", ac.text_of(msg), ms)
    return ac.text_of(msg)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def main() -> None:
    spec = ac.load_spec(args.spec)
    cfg = spec["agents"]
    w = WorkspaceClient()
    host, headers = w.config.host, w.config.authenticate()
    mcp_url = ac.mcp_url(host, args.catalog, args.schema)
    listing, _ = ac.mcp_rpc(mcp_url, headers, "tools/list", rid=2)
    mcp_tools, aliases = ac.mcp_tools_as_chat_tools(listing["result"]["tools"])

    messages = [
        {"role": "system", "content": "You are the supervisor. Hand the order lookup to orders_agent first, then hand the facts and the customer question to policy_agent. Return policy_agent's reply as the final answer."},
        {"role": "user", "content": spec["prompt"]},
    ]
    final = ""
    handoffs = []
    for _ in range(MAX_STEPS):
        msg, ms = model_call(host, headers, cfg["supervisor_model"], messages, HANDOFF_TOOL)
        calls = ac.tool_calls_of(msg)
        if not calls:
            final = ac.text_of(msg)
            record("supervisor", "final", final, ms)
            break
        messages.append(msg)
        for call in calls:
            req = json.loads(call["function"]["arguments"])
            record("supervisor", "handoff", f"{req['agent']}: {req['task']}", ms)
            handoffs.append(req["agent"])
            if req["agent"] == "orders_agent":
                answer = run_orders_agent(host, headers, cfg["orders_model"], req["task"], mcp_url, mcp_tools, aliases)
            else:
                answer = run_policy_agent(host, headers, cfg["policy_model"], req["task"], cfg["policy_text"])
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": answer})
    assert final, "supervisor did not produce a final answer"
    assert handoffs[:2] == ["orders_agent", "policy_agent"], handoffs

    cols = ["run_id", "step", "agent", "kind", "detail", "latency_ms"]
    (spark.createDataFrame(trace, cols).withColumn("recorded_at", F.current_timestamp())
        .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(ac.qualified(args.catalog, args.schema, "agent_handoff_trace")))
    for row in trace:
        print(row[1], row[2], row[3], f"{row[5]} ms", row[4][:160].replace("\n", " "))
    dbutils.jobs.taskValues.set(key="handoffs", value=",".join(handoffs))

# COMMAND ----------

main()
