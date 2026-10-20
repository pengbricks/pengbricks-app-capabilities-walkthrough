# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Insert, update, and delete on SQL Server
# MAGIC
# MAGIC This notebook plays the application during a business day, through the `lakeflow_demo_app` login:
# MAGIC
# MAGIC | Change | Table | What bronze should show |
# MAGIC |---|---|---|
# MAGIC | 3 customers move to the next plan | `customers` (CDC, SCD type 2) | A new current version, and the old one closed with `__END_AT` |
# MAGIC | 10 new orders | `orders` (Change Tracking, SCD type 1) | 10 new rows |
# MAGIC | 5 orders shipped | `orders` | `status = 'SHIPPED'` |
# MAGIC | 2 cancelled orders deleted | `orders` | Rows gone |
# MAGIC | 2 shipped orders cancelled | `orders` | `status = 'CANCELLED'` (next run's deletes) |
# MAGIC
# MAGIC Every run picks the rows touched least recently, so a rerun changes different rows. The expected result of each change is saved to `lfc_expected_changes` for the next step to check.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_lakeflow_connect",
                     ["catalog", "schema", "sqlserver_connection", "sqlserver_database", "secret_scope", "run_id"], defaults={"run_id": "manual"})
catalog, schema = params["catalog"], params["schema"]

import lfc_lib as l
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host, port = l.source_settings(w, params["sqlserver_connection"])
source = l.connect(host, port, params["sqlserver_database"],
                   dbutils.secrets.get(params["secret_scope"], "sqlserver_app_user"),
                   dbutils.secrets.get(params["secret_scope"], "sqlserver_app_password"))

# COMMAND ----------

import datetime as dt
committed_at = dt.datetime.now(dt.timezone.utc)
expected = l.make_changes(source)

frame = spark.createDataFrame(
    [(params["run_id"], committed_at, e["kind"], e["source_table"], e["key"], e["column"], e["value"]) for e in expected],
    "run_id string, committed_at timestamp, kind string, source_table string, key int, column string, value string",
)
frame.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(l.fq(catalog, schema, "lfc_expected_changes"))
display(frame)

counts = frame.groupBy("kind").count().collect()
l.write_results(spark, catalog, schema, params["run_id"], "make_changes", [(f"{r['kind']}_count", r["count"], "source rows changed") for r in counts])
