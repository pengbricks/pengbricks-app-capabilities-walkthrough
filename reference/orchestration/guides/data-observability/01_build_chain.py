# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Build the table chain
# MAGIC
# MAGIC Safe to rerun: the three tables are overwritten or replaced from a fixed seed.
# MAGIC
# MAGIC Builds three tables with SQL so Unity Catalog records lineage: source, then silver, then gold. Each table is overwritten or replaced, so a rerun gives the same rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_observability", ['catalog', 'schema', 'use_case'])
prefix = f"{params['catalog']}.{params['schema']}"

import guide_lib as g
spec = g.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
baseline = spec["observability"]["batches"][0]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Hop 0: the source table

# COMMAND ----------

g.build_orders(spark, spec, rows=int(baseline["rows"]), seed_offset=int(baseline["seed_offset"])).write.mode(
    "overwrite"
).option("overwriteSchema", "true").saveAsTable(f"{prefix}.obs_source_orders")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Hop 1: silver keeps valid rows and rounds amounts

# COMMAND ----------

spark.sql(
    f"""
    CREATE OR REPLACE TABLE {prefix}.obs_silver_orders AS
    SELECT order_id, customer_id, order_ts, region, status, quantity, ROUND(amount, 2) AS amount
    FROM {prefix}.obs_source_orders
    WHERE amount > 0
    """
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Hop 2: gold aggregates silver by day and region

# COMMAND ----------

spark.sql(
    f"""
    CREATE OR REPLACE TABLE {prefix}.obs_gold_daily_revenue AS
    SELECT DATE(order_ts) AS order_date, region, COUNT(*) AS orders, ROUND(SUM(amount), 2) AS revenue
    FROM {prefix}.obs_silver_orders
    GROUP BY DATE(order_ts), region
    """
)
for name in ("obs_source_orders", "obs_silver_orders", "obs_gold_daily_revenue"):
    print(name, spark.table(f"{prefix}.{name}").count(), "rows")
