# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 7. Cleanup
# MAGIC
# MAGIC Safe to rerun. This notebook removes what the others created, but only when the `cleanup` parameter is `delete`. The default is `keep`, which changes nothing, so the demo stays in place after a normal run. Each step checks that its object exists first, so a second run, or a run after a partial failure, finds nothing to do and succeeds.
# MAGIC
# MAGIC What `delete` removes, in order:
# MAGIC
# MAGIC 1. The registered Unity Catalog catalog.
# MAGIC 2. The synced table (the Postgres copy and its pipeline).
# MAGIC 3. The Change Data Feed configuration, which stops the feed's continuous writes. The Delta history table is dropped with it.
# MAGIC 4. The dev branch, if one is left over.
# MAGIC 5. The Delta tables `lakebase_products` and `lb_orders_history`.
# MAGIC 6. The Postgres schemas the notebooks created. The Lakebase project is untouched.
# MAGIC
# MAGIC **What costs money while idle.** Compute that scales to zero bills nothing while suspended, and the demo data is a few kilobytes. The project, the production branch, and the bundle's dev branch (which expires on its own) stay. To remove them, run `databricks bundle destroy`, which deletes the project and, because the project sets `purge_on_delete`, its data too.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound, DatabricksError
import lakebase_lib as lb

params = load_params(dbutils, "capability_guides_lakebase_apps", ['catalog', 'schema', 'lakebase_project', 'app_schema', 'dev_branch', 'lakebase_catalog', 'cleanup'],
                     defaults={'app_schema': 'lakebase_apps', 'dev_branch': 'dev-demo', 'lakebase_catalog': 'lakebase_apps_demo', 'cleanup': 'keep'})
w = WorkspaceClient()
catalog, schema = params["catalog"], lb.ident(params["schema"])
project, app_schema = params["lakebase_project"], lb.ident(params["app_schema"])
catalog_id = lb.ident(params["lakebase_catalog"])
branch = lb.branch_name(project, lb.BRANCH)
dev = lb.branch_name(project, params["dev_branch"])
synced_name = f"synced_tables/{catalog}.{schema}.lakebase_products_synced"

def exists(fetch):
    try:
        return fetch() is not None
    except NotFound:
        return False
    except DatabricksError:
        return False

def cdf_config_name():
    try:
        database = lb.find_database_path(w, branch, lb.DATABASE)
        return next((c.name for c in w.postgres.list_cdf_configs(parent=database) if c.postgres_schema == app_schema), None)
    except (NotFound, LookupError, DatabricksError):
        return None

found = {
    "catalog": exists(lambda: w.postgres.get_catalog(name=f"catalogs/{catalog_id}")),
    "synced_table": exists(lambda: w.postgres.get_synced_table(name=synced_name)),
    "cdf_config": cdf_config_name() is not None,
    "dev_branch": exists(lambda: w.postgres.get_branch(name=dev)),
    "delta_tables": any(spark.catalog.tableExists(f"{catalog}.{schema}.{t}") for t in ("lakebase_products", "lb_orders_history")),
    "postgres_schemas": exists(lambda: w.postgres.get_project(name=lb.project_name(project))),
}
steps = lb.cleanup_actions(params["cleanup"], found)
print(f"cleanup = {params['cleanup']}")
print("Found:", {k: v for k, v in found.items() if v} or "nothing")
print("Will run:", steps or "nothing")
if not steps:
    dbutils.notebook.exit("nothing to do" if params["cleanup"].lower() == "delete" else "kept")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Delete

# COMMAND ----------

if "catalog" in steps:
    w.postgres.delete_catalog(name=f"catalogs/{catalog_id}").wait()
    print("Deleted catalog", catalog_id)

if "synced_table" in steps:
    w.postgres.delete_synced_table(name=synced_name).wait()
    print("Deleted synced table")

if "cdf_config" in steps:
    # force=True also drops the Delta history tables.
    w.postgres.delete_cdf_config(name=cdf_config_name(), force=True).wait()
    print("Deleted the change data feed and its history tables")

if "dev_branch" in steps:
    for endpoint in w.postgres.list_endpoints(parent=dev):
        w.postgres.delete_endpoint(name=endpoint.name).wait()
    w.postgres.delete_branch(name=dev).wait()
    print("Deleted branch", params["dev_branch"])

if "delta_tables" in steps:
    for table in ("lakebase_products", "lb_orders_history"):
        spark.sql(f"DROP TABLE IF EXISTS {catalog}.{schema}.{table}")
    print("Dropped the Delta tables")

if "postgres_schemas" in steps:
    user = w.current_user.me().user_name
    pool = lb.make_pool(w, lb.endpoint_name(project, lb.BRANCH, lb.ENDPOINT), user)
    lb.connect_with_retry(pool)
    with pool.connection() as conn:
        for name in (app_schema, "lakebase_vectors", schema):
            conn.execute(f'DROP SCHEMA IF EXISTS "{lb.ident(name)}" CASCADE')
    pool.close()
    print("Dropped the Postgres schemas")
