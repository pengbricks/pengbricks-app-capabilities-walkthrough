# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Read the deployed app
# MAGIC
# MAGIC Calls `apps.get` for the demo app and prints what an admin or reviewer needs: the URL, compute size and status, the active deployment and its source path, the declared resources, the user API scopes, and the app's service principal. Then it writes one row to `databricks_apps_inventory`.
# MAGIC
# MAGIC **Cost.** The app bills about 0.5 DBU per hour while it is running (Medium). Reading it costs nothing. `05_cleanup` stops it.
# MAGIC
# MAGIC Safe to rerun: the notebook only reads the app. It writes with `MERGE` on `app_name`, so a second run updates the same row and the table never gains a duplicate.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_databricks_apps", ['catalog', 'schema', 'app_name', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, app_name, run_id = (params[k] for k in ('catalog', 'schema', 'app_name', 'run_id'))

# COMMAND ----------

from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
import apps_lib as lib

w = WorkspaceClient()
try:
    app = w.apps.get(name=app_name).as_dict()
except NotFound:
    raise RuntimeError(f"App {app_name!r} does not exist. Deploy the bundle first: databricks bundle deploy, then bundle run databricks_apps_demo.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## What the platform reports

# COMMAND ----------

row = lib.inventory_row(app, run_id, datetime.now(timezone.utc))
deployment = app.get("active_deployment") or {}
print(f"URL                 {row['url']}")
print(f"Compute size        {row['compute_size']} ({row['dbu_per_hour']} DBU per hour while running)")
print(f"App status          {row['app_state']}: {(app.get('app_status') or {}).get('message', '')}")
print(f"Compute status      {row['compute_state']}")
print(f"Active deployment   {row['deployment_id'] or 'none'} ({row['deployment_state']})")
print(f"Source code path    {row['source_code_path'] or 'none'}")
print(f"User API scopes     {row['user_api_scopes'] or 'none declared'}")
print(f"Effective scopes    {', '.join(app.get('effective_user_api_scopes') or []) or 'none'}")
print(f"Service principal   {row['service_principal_name']} (client id {row['service_principal_client_id']})")
print()
print("Resources the app service principal can use:")
display(spark.createDataFrame([lib.describe_resource(r) for r in app.get("resources") or []] or [{"name": "", "type": "", "permission": ""}],
                              "name string, type string, permission string"))
if not lib.is_billing(app):
    print("The app is not running, so it is not billing. Start it with: databricks bundle run databricks_apps_demo")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the inventory row
# MAGIC
# MAGIC `CREATE TABLE IF NOT EXISTS` creates the table once. `MERGE` keyed on `app_name` replaces this app's row on every run.

# COMMAND ----------

table = f"`{catalog}`.`{schema}`.databricks_apps_inventory"
spark.sql(f"""CREATE TABLE IF NOT EXISTS {table} (
  app_name STRING, url STRING, compute_size STRING, dbu_per_hour DOUBLE, app_state STRING, compute_state STRING,
  deployment_id STRING, deployment_state STRING, source_code_path STRING, resources STRING, user_api_scopes STRING,
  service_principal_name STRING, service_principal_client_id STRING, captured_at TIMESTAMP, run_id STRING)""")
spark.sql(lib.inventory_merge_sql(table, row))
display(spark.table(table).where(f"app_name = '{app_name}'"))
assert spark.table(table).where(f"app_name = '{app_name}'").count() == 1, "inventory must hold one row per app"
