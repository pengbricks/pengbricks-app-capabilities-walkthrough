# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Deploy the endpoint
# MAGIC
# MAGIC Creates the Model Serving endpoint, or updates it in place when it already exists, so a rerun never makes a second endpoint. It is Small with scale-to-zero on. Route optimization is requested only if the spec asks for it and the workspace allows it. The notebook then waits until the endpoint is ready.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_realtime_scoring", ['catalog', 'schema', 'use_case', 'endpoint_name'])
catalog, schema, endpoint_name = params["catalog"], params["schema"], params["endpoint_name"]

import yaml
with open(bundle_root() / "use_cases" / f"{params['use_case']}.yml") as handle:
    spec = yaml.safe_load(handle)
settings = spec["endpoint"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pick the model version
# MAGIC
# MAGIC In the job, `01_train_register` passes the version it registered. Run by hand, the notebook uses the version behind the model's alias.

# COMMAND ----------

from mlflow import MlflowClient

def task_value(task_key, key):
    """The value an upstream job task passed on, or None when this notebook runs on its own."""
    try:
        return dbutils.jobs.taskValues.get(taskKey=task_key, key=key, default=None, debugValue=None)
    except ValueError:
        return None

model_name = task_value("train_register", "model_name")
version = task_value("train_register", "model_version")
if not model_name or not version:
    model_name = f"{catalog}.{schema}.{spec['model']['name']}"
    version = str(MlflowClient(registry_uri="databricks-uc").get_model_version_by_alias(model_name, spec["model"]["alias"]).version)
print(f"Deploying {model_name} version {version}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create or update the endpoint

# COMMAND ----------

import time
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import DatabricksError, NotFound
from databricks.sdk.service.serving import EndpointCoreConfigInput, ServedEntityInput

w = WorkspaceClient()
config = EndpointCoreConfigInput(
    name=endpoint_name,
    served_entities=[
        ServedEntityInput(
            name="scorer",
            entity_name=model_name,
            entity_version=version,
            workload_size=settings["workload_size"],
            scale_to_zero_enabled=bool(settings["scale_to_zero"]),
        )
    ]
)

action = "updated"
route_optimized = False
try:
    existing = w.serving_endpoints.get(endpoint_name)
    route_optimized = bool(existing.route_optimized)
    w.serving_endpoints.update_config(name=endpoint_name, served_entities=config.served_entities)
    print(f"Updating existing endpoint {endpoint_name} to version {version}")
except NotFound:
    action = "created"
    wanted = bool(settings.get("route_optimized"))
    try:
        w.serving_endpoints.create(name=endpoint_name, config=config, route_optimized=wanted)
        route_optimized = wanted
    except DatabricksError as error:
        if not wanted:
            raise
        print(f"Route optimization unavailable ({error}); creating without it")
        w.serving_endpoints.create(name=endpoint_name, config=config)
    print(f"Creating endpoint {endpoint_name} (route_optimized={route_optimized})")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Wait until ready

# COMMAND ----------

deadline = time.time() + int(settings["ready_timeout_seconds"])
started = time.time()
while True:
    endpoint = w.serving_endpoints.get(endpoint_name)
    ready = str(endpoint.state.ready).split(".")[-1]
    update = str(endpoint.state.config_update).split(".")[-1]
    print(f"state ready={ready} config_update={update}")
    if ready == "READY" and update == "NOT_UPDATING":
        break
    if update in ("UPDATE_FAILED", "UPDATE_CANCELED") or time.time() > deadline:
        raise RuntimeError(f"Endpoint did not become ready: ready={ready} config_update={update}")
    time.sleep(20)

entity = endpoint.config.served_entities[0]
info = {
    "endpoint_name": endpoint_name,
    "action": action,
    "model_version": version,
    "workload_size": str(entity.workload_size),
    "scale_to_zero": bool(entity.scale_to_zero_enabled),
    "route_optimized": bool(endpoint.route_optimized),
    "endpoint_url": endpoint.endpoint_url,
    "seconds_to_ready": round(time.time() - started),
}
print(info)
for key, value in info.items():
    dbutils.jobs.taskValues.set(key=key, value=value)
