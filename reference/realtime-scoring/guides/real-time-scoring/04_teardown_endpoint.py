# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Delete the endpoint
# MAGIC
# MAGIC Deletes the serving endpoint and confirms it is no longer listed. Safe to rerun: a missing endpoint is not an error. Run it when you finish, so nothing keeps running.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_realtime_scoring_teardown", ['endpoint_name'])
endpoint_name = params["endpoint_name"]

# COMMAND ----------

import time
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound

w = WorkspaceClient()
try:
    w.serving_endpoints.delete(endpoint_name)
    print(f"Deleted endpoint {endpoint_name}")
except NotFound:
    print(f"Endpoint {endpoint_name} does not exist; nothing to delete")
else:
    for _ in range(30):
        names = {endpoint.name for endpoint in w.serving_endpoints.list()}
        if endpoint_name not in names:
            print("Confirmed: endpoint no longer listed")
            break
        time.sleep(5)
    else:
        raise RuntimeError(f"Endpoint {endpoint_name} still listed after delete")
