# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Record the release
# MAGIC
# MAGIC Appends one row to `model_release_history` (an audit table, so it grows by one row per run) and links the model version back to it with tags.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_release", ['catalog', 'schema', 'use_case', 'release', 'target', 'champion_alias', 'endpoint_name'])
for name in ["approved_by", "model_version", "status", "endpoint", "served_version", "latency_ms", "job_run_id"]:
    dbutils.widgets.text(name, "")
opt = {name: dbutils.widgets.get(name).strip() for name in ["approved_by", "model_version", "status", "endpoint", "served_version", "latency_ms", "job_run_id"]}

from datetime import datetime, timezone
import common
import mlflow
from mlflow.tracking import MlflowClient
from pyspark.sql import types as T

catalog, schema = params["catalog"], params["schema"]
spec = common.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
model_name = common.full_model_name(catalog, schema, spec)
history = f"{catalog}.{schema}.model_release_history"
mlflow.set_registry_uri("databricks-uc")
client = MlflowClient(registry_uri="databricks-uc")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Fill what the job passes in
# MAGIC
# MAGIC In the job, the version and deployment result come from earlier tasks. Standalone, blank widgets take the latest version and read the endpoint's current state.

# COMMAND ----------

model_version = opt["model_version"] or str(max(int(v.version) for v in client.search_model_versions(f"name = '{model_name}'")))
status, endpoint, served_version, latency_ms = opt["status"], opt["endpoint"], opt["served_version"], opt["latency_ms"]
if not status:
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.errors import NotFound

    try:
        state = WorkspaceClient().api_client.do("GET", f"/api/2.0/serving-endpoints/{params['endpoint_name']}")
        entities = state.get("config", {}).get("served_entities", [])
        status, endpoint = "deployed", params["endpoint_name"]
        served_version = str(entities[0].get("entity_version", "")) if entities else ""
    except NotFound:
        status = "not_promoted"
print(f"version={model_version} status={status} endpoint={endpoint} served_version={served_version}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Append the history row and tag the version

# COMMAND ----------

SCHEMA = T.StructType(
    [
        T.StructField("model_name", T.StringType()),
        T.StructField("model_version", T.StringType()),
        T.StructField("aliases", T.ArrayType(T.StringType())),
        T.StructField("metrics", T.MapType(T.StringType(), T.DoubleType())),
        T.StructField("release_sha", T.StringType()),
        T.StructField("approved_by", T.StringType()),
        T.StructField("target", T.StringType()),
        T.StructField("status", T.StringType()),
        T.StructField("endpoint", T.StringType()),
        T.StructField("served_version", T.StringType()),
        T.StructField("training_run_url", T.StringType()),
        T.StructField("job_run_id", T.StringType()),
        T.StructField("deployed_at", T.TimestampType()),
    ]
)

mv = client.get_model_version(model_name, model_version)
metrics = dict(client.get_run(mv.run_id).data.metrics)
metrics["serving_latency_ms"] = float(latency_ms or 0)
now = datetime.now(timezone.utc)

row = (
    model_name,
    str(mv.version),
    sorted(mv.aliases),
    {k: float(v) for k, v in metrics.items()},
    params["release"],
    opt["approved_by"] or None,
    params["target"],
    status,
    endpoint or None,
    served_version or None,
    (mv.tags or {}).get("training_run_url"),
    opt["job_run_id"],
    now,
)
spark.createDataFrame([row], SCHEMA).write.mode("append").option("mergeSchema", "true").saveAsTable(history)

for key, value in {
    "release_history_table": history,
    "release_status": status,
    "release_target": params["target"],
    "released_at": now.isoformat(),
    "endpoint": endpoint,
}.items():
    client.set_model_version_tag(model_name, mv.version, key, value)
print(f"Recorded {status} for version {mv.version} in {history}")
