"""Test the agent locally with tracing, log it from code, and register a version in Unity Catalog."""

import argparse
import importlib.metadata as md
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--experiment", required=True)
p.add_argument("--warehouse-id", required=True)
p.add_argument("--release", default="local")
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import agents_common as ac
import mlflow
from databricks.sdk.runtime import dbutils
from mlflow.models.resources import DatabricksFunction, DatabricksServingEndpoint, DatabricksSQLWarehouse, DatabricksTable
from mlflow.tracking import MlflowClient

PIP_REQUIREMENTS = ["mlflow>=3.1", "databricks-sdk>=0.152", "openai", "httpx"]


def main() -> None:
    spec = ac.load_spec(args.spec)
    build = spec["build"]
    cat, sch = args.catalog, args.schema
    fn = ac.qualified(cat, sch, spec["tool"]["function"])
    table = ac.qualified(cat, sch, spec["data"]["table"])
    model_name = ac.qualified(cat, sch, build["model_name"])
    code_path = f"{args.src_dir}/agent/assistant.py"
    config = {
        "llm_endpoint": build["llm_endpoint"], "function": fn, "function_comment": spec["tool"]["comment"],
        "warehouse_id": args.warehouse_id, "system_prompt": build["system_prompt"], "max_tool_rounds": build["max_tool_rounds"],
    }
    mlflow.set_registry_uri("databricks-uc")
    mlflow.set_experiment(args.experiment)

    # Local test: the same code the endpoint runs, with traces written to the experiment.
    import importlib.util

    from mlflow.models import ModelConfig
    from mlflow.types.responses import ResponsesAgentRequest

    spec_mod = importlib.util.spec_from_file_location("assistant_local", code_path)
    mod = importlib.util.module_from_spec(spec_mod)
    spec_mod.loader.exec_module(mod)
    agent = mod.SupportAssistant()
    agent.cfg = ModelConfig(development_config=config)
    question = build["test_question"]
    reply = agent.predict(ResponsesAgentRequest(input=[{"role": "user", "content": question}]))
    answer = reply.output[0].content[0]["text"] if isinstance(reply.output[0].content[0], dict) else reply.output[0].content[0].text
    print("local answer:", answer)
    traces = mlflow.search_traces(experiment_ids=[mlflow.get_experiment_by_name(args.experiment).experiment_id], max_results=5)
    print("traces in experiment:", len(traces))

    with mlflow.start_run(run_name="log_support_assistant") as run:
        info = mlflow.pyfunc.log_model(
            name="agent",
            python_model=code_path,
            model_config=config,
            pip_requirements=PIP_REQUIREMENTS,
            resources=[DatabricksServingEndpoint(endpoint_name=build["llm_endpoint"]), DatabricksFunction(function_name=fn), DatabricksTable(table_name=table), DatabricksSQLWarehouse(warehouse_id=args.warehouse_id)],
            input_example={"input": [{"role": "user", "content": question}]},
            registered_model_name=model_name,
        )
        mlflow.set_tags({"release": args.release, "tool_function": fn})
    client = MlflowClient(registry_uri="databricks-uc")
    version = str(info.registered_model_version)
    client.set_registered_model_alias(model_name, "champion", version)
    client.set_model_version_tag(model_name, version, "release", args.release)
    client.set_model_version_tag(model_name, version, "tool_function", fn)
    versions = {pkg: md.version(pkg) for pkg in ["mlflow", "databricks-sdk", "openai", "httpx"]}
    print(f"registered {model_name} version {version} alias champion; packages {versions}")
    dbutils.jobs.taskValues.set(key="model_name", value=model_name)
    dbutils.jobs.taskValues.set(key="version", value=version)
    dbutils.jobs.taskValues.set(key="run_id", value=run.info.run_id)
    dbutils.jobs.taskValues.set(key="trace_count", value=len(traces))
    dbutils.jobs.taskValues.set(key="local_answer", value=answer[:500])


main()
