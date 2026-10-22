# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 7. Teardown
# MAGIC
# MAGIC Delete the agent's Model Serving endpoint and the gateway model services with their inference tables.
# MAGIC
# MAGIC Keeps the registered model versions, the sample data, and every record table.
# MAGIC
# MAGIC Safe to rerun: a missing endpoint or service is skipped, so a second run changes nothing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_agent_teardown", ['catalog', 'schema', 'use_case', 'delete_gateway_services'])

# COMMAND ----------

from types import SimpleNamespace
args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    src_dir=str(bundle_root() / "src"),
    spec=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
    endpoint_name="",
    delete_gateway_services=params["delete_gateway_services"],
)

import sys
import agents_common as ac
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def main() -> None:
    spec = ac.load_spec(args.spec)
    w = WorkspaceClient()
    name = args.endpoint_name or spec["build"]["endpoint_name"]
    try:
        w.serving_endpoints.delete(name)
        print(f"deleted serving endpoint {name}")
    except NotFound:
        print(f"serving endpoint {name} not found; nothing to delete")
    try:
        w.serving_endpoints.get(name)
        raise Exception(f"endpoint {name} still exists")
    except NotFound:
        print(f"confirmed: {name} is gone")

    if ac.to_bool(args.delete_gateway_services):
        for svc in spec["gateway"]["services"]:
            fq = ac.qualified(args.catalog, args.schema, svc["name"])
            try:
                w.ai_gateway.delete_model_service(name=f"model-services/{fq}")
                print(f"deleted model service {fq}")
            except NotFound:
                print(f"model service {fq} not found")
            spark.sql(f"DROP TABLE IF EXISTS {fq}_payload")

# COMMAND ----------

main()
