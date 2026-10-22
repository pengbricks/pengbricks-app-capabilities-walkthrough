# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Prepare data
# MAGIC
# MAGIC Replaces `zo_orders` with 500 sample orders over 90 days. Every value derives from the row id and a fixed seed, so each run writes the same rows.
# MAGIC
# MAGIC Required setup: the `capability_guides` schema exists (deploy the `foundation` bundle first).
# MAGIC
# MAGIC Safe to rerun: `CREATE OR REPLACE TABLE` swaps the whole table, so it always has 500 rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from zeroops_lib import orders_sql

params = load_params(dbutils, "capability_guides_zeroops_demo", ["catalog", "schema"])
catalog, schema = params["catalog"], params["schema"]

# COMMAND ----------

ROWS, SEED = 500, 42
table = f"{catalog}.{schema}.zo_orders"
spark.sql(orders_sql(table, ROWS, SEED))
count = spark.table(table).count()
assert count == ROWS, f"expected {ROWS} rows, found {count}"
print(f"{table}: {count} rows")
