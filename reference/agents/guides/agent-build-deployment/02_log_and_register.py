# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Test, log and register the agent
# MAGIC
# MAGIC Test the agent locally with tracing, log it from code, and register a version in Unity Catalog. Safe to rerun: the experiment is reused, `champion` is set, not added, and each run registers a new model version (versions are history).

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_agent_build", ['catalog', 'schema', 'use_case', 'release', 'experiment', 'warehouse_id'])

# COMMAND ----------

from types import SimpleNamespace
args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    src_dir=str(bundle_root() / "src"),
    spec=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
    experiment=params["experiment"],
    warehouse_id=params["warehouse_id"],
    release=params["release"],
)

import importlib.metadata as md
import sys
import agents_common as ac
import mlflow
from mlflow.models.resources import DatabricksFunction, DatabricksServingEndpoint, DatabricksSQLWarehouse, DatabricksTable
from mlflow.tracking import MlflowClient
PIP_REQUIREMENTS = ["mlflow>=3.1", "databricks-sdk>=0.152", "openai", "httpx"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

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

# COMMAND ----------

main()
