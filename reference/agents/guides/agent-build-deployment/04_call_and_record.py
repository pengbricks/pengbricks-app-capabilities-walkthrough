# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Call the agent and record the build
# MAGIC
# MAGIC Call the deployed agent, check its trace, and write the build record (code, dependencies, owners). Safe to rerun: it only calls the endpoint; `agent_build_record` is a history table and gets one row per run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_agent_build", ['catalog', 'schema', 'use_case', 'release'])

# COMMAND ----------

import mlflow
from mlflow.tracking import MlflowClient
import agents_common as ac
_spec = ac.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
_model = ac.qualified(params["catalog"], params["schema"], _spec["build"]["model_name"])
def champion_version() -> str:
    mlflow.set_registry_uri("databricks-uc")
    return str(MlflowClient(registry_uri="databricks-uc").get_model_version_by_alias(_model, "champion").version)
for _n in ["endpoint", "version", "model_run_id", "ready_seconds"]:
    dbutils.widgets.text(_n, "")
opt = {n: dbutils.widgets.get(n).strip() for n in ["endpoint", "version", "model_run_id", "ready_seconds"]}
# In the job these come from earlier tasks. Standalone, blanks take the spec's endpoint and the @champion version.
endpoint = opt["endpoint"] or _spec["build"]["endpoint_name"]
version = opt["version"] or champion_version()
from types import SimpleNamespace
args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    src_dir=str(bundle_root() / "src"),
    spec=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
    endpoint=endpoint,
    version=version,
    model_run_id=opt["model_run_id"],
    ready_seconds=opt["ready_seconds"] or "0",
    release=params["release"],
)

import importlib.metadata as md
import json
import sys
import time
import agents_common as ac
from databricks.sdk import WorkspaceClient
from pyspark.sql import functions as F

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def main() -> None:
    spec = ac.load_spec(args.spec)
    build = spec["build"]
    w = WorkspaceClient()
    body = {
        "input": [{"role": "user", "content": build["test_question"]}],
        "databricks_options": {"return_trace": True},
    }
    results = []
    for attempt in range(2):
        for retry in range(6):
            start = time.perf_counter()
            try:
                out = w.api_client.do("POST", f"/serving-endpoints/{args.endpoint}/invocations", body=body)
                break
            except Exception as exc:  # a cold or just-ready endpoint can return 503 for a short time
                print(f"retry {retry}: {exc}")
                time.sleep(20)
        else:
            raise Exception("Endpoint did not answer")
        ms = (time.perf_counter() - start) * 1000
        results.append((out, ms))
        print(f"request {attempt + 1}: {ms:.0f} ms")
    out, _ = results[-1]
    text = " ".join(c.get("text", "") for item in out.get("output", []) for c in item.get("content", []) if isinstance(c, dict))
    trace = out.get("databricks_output", {}).get("trace") or {}
    spans = trace.get("data", {}).get("spans", []) if isinstance(trace, dict) else []
    span_names = sorted({s.get("name") for s in spans})
    print("answer:", text)
    print("trace spans returned by the endpoint:", span_names)
    assert text, f"empty answer: {json.dumps(out)[:500]}"
    tool_spans = [n for n in span_names if n == "uc_function_tool"]
    assert tool_spans, f"the endpoint answered without calling the tool; spans: {span_names}"
    assert "status=" in json.dumps(spans), "tool span carries no order data"

    info = w.serving_endpoints.get(args.endpoint)
    entity = info.config.served_entities[0]
    owner = w.current_user.me().user_name
    model_name = ac.qualified(args.catalog, args.schema, build["model_name"])
    row = {
        "model": model_name, "model_version": args.version, "alias": "champion", "release": args.release,
        "endpoint": args.endpoint, "workload_size": str(entity.workload_size), "scale_to_zero": bool(entity.scale_to_zero_enabled),
        "deployed_by": owner, "llm_endpoint": build["llm_endpoint"],
        "code_path": "reference/agents/src/agent/assistant.py",
        "tool_function": ac.qualified(args.catalog, args.schema, spec["tool"]["function"]),
        "dependencies": "mlflow>=3.1, databricks-sdk>=0.152, openai, httpx",
        "resolved_packages": ", ".join(f"{k}=={md.version(k)}" for k in ["mlflow", "databricks-sdk", "openai", "httpx"]),
        "owners": "; ".join(f"{o['role']}: {o['responsibility']}" for o in build["owners"]),
        "first_request_ms": round(results[0][1], 1), "second_request_ms": round(results[1][1], 1),
        "ready_seconds": int(args.ready_seconds), "trace_spans": ", ".join(n for n in span_names if n),
        "answer": text[:600], "model_run_id": args.model_run_id,
    }
    (spark.createDataFrame([row]).withColumn("recorded_at", F.current_timestamp())
        .write.mode("append").option("mergeSchema", "true").saveAsTable(ac.qualified(args.catalog, args.schema, "agent_build_record")))
    spark.table(ac.qualified(args.catalog, args.schema, "agent_build_record")).orderBy(F.desc("recorded_at")).limit(1).show(vertical=True, truncate=100)

# COMMAND ----------

main()
