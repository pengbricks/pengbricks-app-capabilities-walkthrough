# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Land the source data
# MAGIC
# MAGIC Downloads UCI Online Retail II (CC BY 4.0) into a Unity Catalog volume, checks its pinned SHA-256, and writes every invoice line to the transactions table as-is, blank customer IDs included. Then it builds the source table: one row per customer who ordered before the snapshot date, with the churn label. Both tables are overwritten, so a rerun replaces the data.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_feature_preparation", ['catalog', 'schema', 'use_case', 'source_volume'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
import public_data
spec = c.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

src = spec["source"]
transactions = c.fq(catalog, schema, src["transactions_table"])
lines = c.land_transactions(spark, spec, transactions, f"/Volumes/{catalog}/{schema}/{params['source_volume']}")
blank = spark.sql(f"SELECT count(*) FROM {transactions} WHERE customer_id IS NULL").collect()[0][0]
print(f"Landed {lines} invoice lines in {transactions}; {blank} have no customer ID and stay out of the snapshot")
print(public_data.SOURCES[src["dataset"]]["citation"])

# COMMAND ----------

# MAGIC %md
# MAGIC Features use only invoices before the snapshot date. `churned` is 1 when the customer places no order in the label window that follows. `days_between_orders` is null for customers with one order; step 2 fills it.

# COMMAND ----------

table = c.fq(catalog, schema, src["table"])
df = spark.sql(public_data.customer_snapshot_sql(transactions, src["snapshot_date"], spec["label"]["window_months"]))
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
version = c.delta_version(spark, table)
stats = spark.sql(
    f"SELECT count(*) AS customers, avg({spec['label']['name']}) AS churn_rate, "
    f"count_if(days_between_orders IS NULL) AS single_order FROM {table}"
).first()
dbutils.jobs.taskValues.set(key="source_version", value=version)
print(f"Wrote {stats.customers} customers as of {src['snapshot_date']} to {table} (Delta version {version}); "
      f"churn rate {stats.churn_rate:.3f}, {stats.single_order} single-order customers with a null order gap")
