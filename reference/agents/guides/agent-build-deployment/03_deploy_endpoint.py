# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Deploy the endpoint
# MAGIC
# MAGIC Deploy the registered agent to a small scale-to-zero Model Serving endpoint and wait for READY.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_agent_build", ['catalog', 'schema', 'use_case', 'release', 'experiment_id'])

# COMMAND ----------

import mlflow
from mlflow.tracking import MlflowClient
import agents_common as ac
_spec = ac.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
_model = ac.qualified(params["catalog"], params["schema"], _spec["build"]["model_name"])
def champion_version() -> str:
    mlflow.set_registry_uri("databricks-uc")
    return str(MlflowClient(registry_uri="databricks-uc").get_model_version_by_alias(_model, "champion").version)
dbutils.widgets.text("version", "")
# In the job, the version comes from log_and_register. Standalone, a blank widget takes the version @champion points to.
version = dbutils.widgets.get("version").strip() or champion_version()
from types import SimpleNamespace
args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    src_dir=str(bundle_root() / "src"),
    spec=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
    version=version,
    endpoint_name="",
    experiment_id=params["experiment_id"],
    release=params["release"],
)

import sys
import time
import agents_common as ac
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
READY_TIMEOUT_S = 45 * 60

# COMMAND ----------

# MAGIC %md
# MAGIC ## State

# COMMAND ----------

def state(w: WorkspaceClient, name: str) -> dict:
    return w.api_client.do("GET", f"/api/2.0/serving-endpoints/{name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def main() -> None:
    spec = ac.load_spec(args.spec)
    build = spec["build"]
    name = args.endpoint_name or build["endpoint_name"]
    model_name = ac.qualified(args.catalog, args.schema, build["model_name"])
    w = WorkspaceClient()
    entity = {
        "name": "assistant",
        "entity_name": model_name,
        "entity_version": args.version,
        "workload_size": build["workload_size"],
        "scale_to_zero_enabled": ac.to_bool(build["scale_to_zero"]),
        "environment_vars": {"ENABLE_MLFLOW_TRACING": "true", **({"MLFLOW_EXPERIMENT_ID": args.experiment_id} if args.experiment_id else {})},
    }
    config = {"served_entities": [entity], "traffic_config": {"routes": [{"served_model_name": "assistant", "traffic_percentage": 100}]}}
    tags = [{"key": "capability_guide", "value": "agent-build-deployment"}, {"key": "release", "value": args.release}]
    try:
        state(w, name)
        w.api_client.do("PUT", f"/api/2.0/serving-endpoints/{name}/config", body=config)
        print(f"Updating endpoint {name} to version {args.version}")
    except NotFound:
        w.api_client.do("POST", "/api/2.0/serving-endpoints", body={"name": name, "config": config, "tags": tags})
        print(f"Creating endpoint {name} with version {args.version}")

    deadline = time.time() + READY_TIMEOUT_S
    started = time.time()
    while time.time() < deadline:
        s = state(w, name)["state"]
        print(f"endpoint {name}: ready={s.get('ready')} config_update={s.get('config_update')}")
        if s.get("config_update") == "UPDATE_FAILED":
            raise Exception(f"Endpoint update failed: {s}")
        if s.get("ready") == "READY" and s.get("config_update") == "NOT_UPDATING":
            break
        time.sleep(30)
    else:
        raise Exception(f"Endpoint {name} not READY after {READY_TIMEOUT_S}s")
    dbutils.jobs.taskValues.set(key="endpoint", value=name)
    dbutils.jobs.taskValues.set(key="ready_seconds", value=round(time.time() - started))

# COMMAND ----------

main()
