# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Day two: full refresh of one table
# MAGIC
# MAGIC The job's previous task ran the ingestion pipeline with `full_refresh_selection: [lfc_orders]`. That re-snapshots `dbo.orders` and replaces the bronze table; `lfc_customers` and `lfc_products` keep going incrementally. This notebook checks the result: `lfc_orders` matches the source row count, and `lfc_customers` still has every closed version.
# MAGIC
# MAGIC Never full-refresh a history table on a whim. A full refresh of an SCD type 2 table replaces it, and history restarts from that point.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_lakeflow_connect",
                     ["catalog", "schema", "sqlserver_connection", "sqlserver_database", "secret_scope", "ingestion_pipeline_id", "run_id"],
                     defaults={"run_id": "manual"})
catalog, schema = params["catalog"], params["schema"]

import lfc_lib as l
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host, port = l.source_settings(w, params["sqlserver_connection"])
source = l.connect(host, port, params["sqlserver_database"],
                   dbutils.secrets.get(params["secret_scope"], "sqlserver_app_user"),
                   dbutils.secrets.get(params["secret_scope"], "sqlserver_app_password"))

# COMMAND ----------

source_orders = l.query(source, "SELECT COUNT(*) AS n FROM dbo.orders")[0]["n"]
bronze_orders = spark.table(l.fq(catalog, schema, l.TABLES["orders"])).count()
closed_versions = spark.sql(f"SELECT count(*) FROM {l.fq(catalog, schema, l.TABLES['customers'])} WHERE __END_AT IS NOT NULL").first()[0]

latest = w.pipelines.list_updates(pipeline_id=params["ingestion_pipeline_id"], max_results=1).updates[0]
print(f"update {latest.update_id}: full_refresh_selection={latest.full_refresh_selection}, state={latest.state.value}")
print(f"orders: source {source_orders}, bronze {bronze_orders}; customers closed versions kept: {closed_versions}")

l.write_results(spark, catalog, schema, params["run_id"], "full_refresh", [
    ("source_orders", source_orders, "dbo.orders"),
    ("bronze_orders", bronze_orders, "lfc_orders after the full refresh"),
    ("customer_closed_versions", closed_versions, "history kept: lfc_customers was not refreshed"),
])
assert source_orders == bronze_orders, "lfc_orders does not match the source after the full refresh"
assert closed_versions > 0, "lfc_customers lost its history"
