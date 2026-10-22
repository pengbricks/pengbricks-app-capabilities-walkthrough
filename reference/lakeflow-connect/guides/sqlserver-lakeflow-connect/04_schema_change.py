# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Day two: add a column on the source
# MAGIC
# MAGIC The application team adds `loyalty_tier` to `dbo.customers` and fills it for 20 customers. Nobody touches the pipeline. The DDL capture the setup procedures installed records the change, and the next ingestion run adds the column to `lfc_customers` and loads the values. Because `customers` keeps history, each of those 20 customers gets a new version.
# MAGIC
# MAGIC Renaming a column or changing its type is different: that needs a full refresh of the table (step 5). Safe to rerun: the column is added only if it is missing, and the same 20 customers get a tier from their plan.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_lakeflow_connect",
                     ["catalog", "schema", "sqlserver_connection", "sqlserver_database", "secret_scope",
                      "ingestion_pipeline_id", "max_wait_minutes", "run_id"], defaults={"run_id": "manual", "max_wait_minutes": "20"})
catalog, schema = params["catalog"], params["schema"]

import lfc_lib as l
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host, port = l.source_settings(w, params["sqlserver_connection"])
source = l.connect(host, port, params["sqlserver_database"],
                   dbutils.secrets.get(params["secret_scope"], "sqlserver_app_user"),
                   dbutils.secrets.get(params["secret_scope"], "sqlserver_app_password"))
bronze = l.fq(catalog, schema, l.TABLES["customers"])

# COMMAND ----------

l.query(source, l.ADD_COLUMN_SQL)
tiers = {row["customer_id"]: row[l.NEW_COLUMN] for row in l.query(source, l.SET_TIER_SQL, [20])}
print(f"added {l.NEW_COLUMN}; set it on {len(tiers)} customers")

# COMMAND ----------

def tiers_landed() -> bool:
    if l.NEW_COLUMN not in spark.table(bronze).columns:
        return False
    current = {r["customer_id"]: r[l.NEW_COLUMN] for r in spark.sql(
        f"SELECT customer_id, {l.NEW_COLUMN} FROM {bronze} WHERE __END_AT IS NULL AND customer_id IN ({','.join(map(str, tiers))})").collect()}
    return current == tiers

result = l.ingest_until(w, params["ingestion_pipeline_id"], tiers_landed, max_wait_s=int(params["max_wait_minutes"]) * 60)
print(result)
display(spark.sql(f"DESCRIBE TABLE {bronze}"))

# COMMAND ----------

l.write_results(spark, catalog, schema, params["run_id"], "schema_change", [
    ("column_in_bronze", int(l.NEW_COLUMN in spark.table(bronze).columns), l.NEW_COLUMN),
    ("values_landed", int(result["ok"]), f"{len(tiers)} customers"),
    ("pipeline_updates", len(result["updates"]), "no pipeline change, no full refresh"),
])
assert result["ok"], f"{l.NEW_COLUMN} did not land within {params['max_wait_minutes']} minutes"
