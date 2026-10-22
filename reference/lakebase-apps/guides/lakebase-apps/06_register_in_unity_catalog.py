# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Register the database in Unity Catalog
# MAGIC
# MAGIC Safe to rerun. Registration creates a read-only catalog that mirrors a Lakebase database. Unity Catalog permissions, lineage, and audit logs then apply, and analysts can join the app tables with lakehouse tables. Registration is **Beta**.
# MAGIC
# MAGIC The catalog needs `CREATE CATALOG` on the metastore. If the job identity lacks it, or the call fails for another reason, the notebook prints the steps to do it in Catalog Explorer and ends without failing.
# MAGIC
# MAGIC Querying the catalog needs **serverless** compute. A pro or classic SQL warehouse returns `UC_LAKEBASE_CATALOG_ACCESS_DENIED`.
# MAGIC
# MAGIC A rerun skips creation when the catalog exists. Register one database per catalog, and do not register a branch of a registered database.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound, DatabricksError
from databricks.sdk.service.postgres import Catalog, CatalogCatalogSpec
import lakebase_lib as lb

params = load_params(dbutils, "capability_guides_lakebase_apps", ['lakebase_project', 'warehouse_id', 'lakebase_catalog', 'app_schema'],
                     defaults={'lakebase_catalog': 'lakebase_apps_demo', 'app_schema': 'lakebase_apps'})
w = WorkspaceClient()
project, warehouse_id = params["lakebase_project"], params["warehouse_id"]
catalog_id, app_schema = lb.ident(params["lakebase_catalog"]), lb.ident(params["app_schema"])
branch = lb.branch_name(project, lb.BRANCH)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Register the catalog, or skip it

# COMMAND ----------

def get_catalog():
    try:
        return w.postgres.get_catalog(name=f"catalogs/{catalog_id}")
    except NotFound:
        return None

HAND_STEPS = f"""To register the database by hand:
  1. Open Catalog Explorer and click + > Create a catalog.
  2. Choose Lakebase Postgres as the catalog type, then the Autoscaling option.
  3. Pick project {project}, branch {lb.BRANCH}, and database {lb.DATABASE}. Name the catalog {catalog_id}.
  You need CREATE CATALOG on the metastore. Then rerun this notebook to query it."""

registered = False
action = lb.catalog_action(get_catalog() is not None)
print(f"Catalog {catalog_id}: {action}")
if action == "create":
    try:
        w.postgres.create_catalog(
            catalog=Catalog(spec=CatalogCatalogSpec(branch=branch, postgres_database=lb.DATABASE, create_database_if_missing=False)),
            catalog_id=catalog_id,
        ).wait()
        registered = True
        print("Registered", catalog_id)
    except DatabricksError as error:
        print(f"Could not register the catalog: {type(error).__name__}: {str(error)[:300]}\n\n{HAND_STEPS}")
else:
    registered = True

if not registered:
    dbutils.notebook.exit("skipped: catalog not registered; steps are in the notebook output")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Query it from a serverless SQL warehouse
# MAGIC
# MAGIC The catalog's schemas are the Postgres schemas, so the table is `<catalog>.<app_schema>.orders`. Unity Catalog caches metadata, so a new table can take a moment to appear. The loop retries for a few minutes.

# COMMAND ----------

warehouse = w.warehouses.get(id=warehouse_id)
if not warehouse.enable_serverless_compute:
    print(f"Warning: warehouse {warehouse.name} is not serverless. The registered catalog returns UC_LAKEBASE_CATALOG_ACCESS_DENIED on pro and classic warehouses.")

def run(statement):
    response = w.statement_execution.execute_statement(statement=statement, warehouse_id=warehouse_id, wait_timeout="50s")
    while response.status.state.value in ("PENDING", "RUNNING"):
        time.sleep(3)
        response = w.statement_execution.get_statement(response.statement_id)
    if response.status.state.value != "SUCCEEDED":
        raise RuntimeError(f"{response.status.state.value}: {response.status.error.message if response.status.error else ''}")
    return response.result.data_array if response.result else []

query = f"SELECT order_id, customer, status, amount FROM `{catalog_id}`.`{app_schema}`.orders ORDER BY order_id"

def attempt():
    try:
        return run(query)
    except Exception as error:
        return error

rows = lb.wait_until(attempt, lambda r: not isinstance(r, Exception), timeout=300, interval=15, what="the registered catalog query")
print(f"{len(rows)} orders read through warehouse {warehouse.name}")
display(spark.createDataFrame([(int(r[0]), r[1], r[2], float(r[3])) for r in rows], "order_id INT, customer STRING, status STRING, amount DOUBLE"))
