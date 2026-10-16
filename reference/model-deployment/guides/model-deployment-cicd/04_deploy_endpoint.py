# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Deploy the endpoint
# MAGIC
# MAGIC Serves the `@champion` version on a small scale-to-zero Model Serving endpoint, waits for READY, and scores one row twice (a cold and a warm request). An existing endpoint that already serves this version is left alone. When the gate did not promote, the notebook skips deployment.
# MAGIC
# MAGIC The endpoint is created here, not declared in the bundle, so deleting the bundle does not remove it. Delete it when you are done.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_release", ['catalog', 'schema', 'use_case', 'champion_alias', 'endpoint_name', 'workload_size', 'scale_to_zero', 'release'])
dbutils.widgets.text("promoted", "")

import time
import common
import mlflow
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from mlflow.tracking import MlflowClient

catalog, schema = params["catalog"], params["schema"]
spec = common.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
model_name = common.full_model_name(catalog, schema, spec)
mlflow.set_registry_uri("databricks-uc")
client = MlflowClient(registry_uri="databricks-uc")
w = WorkspaceClient()
READY_TIMEOUT_S = 40 * 60

# In the job, `promoted` comes from approval_gate. Standalone, a blank widget deploys when a champion exists.
promoted_raw = dbutils.widgets.get("promoted").strip()
try:
    client.get_model_version_by_alias(model_name, params["champion_alias"])
    has_champion = True
except mlflow.exceptions.MlflowException:
    has_champion = False
promoted = common.to_bool(promoted_raw) if promoted_raw else has_champion


def set_outputs(status: str, endpoint: str = "", served_version: str = "", latency_ms: float = 0.0) -> None:
    for key, value in {
        "status": status,
        "endpoint": endpoint,
        "served_version": served_version,
        "latency_ms": round(latency_ms, 1),
    }.items():
        dbutils.jobs.taskValues.set(key=key, value=value)


def endpoint_state(name: str) -> dict:
    return w.api_client.do("GET", f"/api/2.0/serving-endpoints/{name}")


def wait_ready(name: str) -> dict:
    deadline = time.time() + READY_TIMEOUT_S
    while time.time() < deadline:
        state = endpoint_state(name)["state"]
        ready, update = state.get("ready"), state.get("config_update")
        print(f"endpoint {name}: ready={ready} config_update={update}")
        if update == "UPDATE_FAILED":
            raise Exception(f"Endpoint update failed: {state}")
        if ready == "READY" and update == "NOT_UPDATING":
            return endpoint_state(name)
        time.sleep(30)
    raise Exception(f"Endpoint {name} not READY after {READY_TIMEOUT_S}s")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create or update the endpoint

# COMMAND ----------

endpoint_name = params["endpoint_name"]
if not promoted:
    print("Not promoted: skipping deployment.")
    set_outputs("not_promoted")
    dbutils.notebook.exit("not_promoted")

version = str(client.get_model_version_by_alias(model_name, params["champion_alias"]).version)
config = {
    "served_entities": [
        {
            "name": "champion",
            "entity_name": model_name,
            "entity_version": version,
            "workload_size": params["workload_size"],
            "scale_to_zero_enabled": common.to_bool(params["scale_to_zero"]),
        }
    ],
    "traffic_config": {"routes": [{"served_model_name": "champion", "traffic_percentage": 100}]},
}
try:
    current = endpoint_state(endpoint_name)
    served = {s.get("entity_version") for s in current.get("config", {}).get("served_entities", [])}
    if served == {version}:
        print(f"Endpoint already serves version {version}")
    else:
        w.api_client.do("PUT", f"/api/2.0/serving-endpoints/{endpoint_name}/config", body=config)
        print(f"Updating endpoint to version {version}")
except NotFound:
    w.api_client.do(
        "POST",
        "/api/2.0/serving-endpoints",
        body={
            "name": endpoint_name,
            "config": config,
            "tags": [{"key": "release", "value": params["release"]}, {"key": "capability_guide", "value": "model-deployment-cicd"}],
        },
    )
    print(f"Creating endpoint {endpoint_name} with version {version}")

wait_ready(endpoint_name)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Score one row twice
# MAGIC
# MAGIC The first call may include a cold start; the second is warm.

# COMMAND ----------

row = spark.table(common.training_table(catalog, schema, spec)).select(*spec["features"]).limit(1).toPandas()
body = {"dataframe_records": row.to_dict(orient="records")}
latencies = []
for attempt in range(2):
    start = time.perf_counter()
    for retry in range(5):
        try:
            result = w.api_client.do("POST", f"/serving-endpoints/{endpoint_name}/invocations", body=body)
            break
        except Exception as exc:  # cold start can return 503 briefly
            print(f"query retry {retry}: {exc}")
            time.sleep(20)
    else:
        raise Exception("Scoring request failed")
    latencies.append((time.perf_counter() - start) * 1000)
    print(f"request {attempt + 1}: {latencies[-1]:.0f} ms -> {result}")

set_outputs("deployed", endpoint_name, version, latencies[-1])
print(f"Deployed version {version}. First request {latencies[0]:.0f} ms, second {latencies[1]:.0f} ms")
