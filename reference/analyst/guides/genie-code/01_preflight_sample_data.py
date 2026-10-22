# Databricks notebook source
# MAGIC %md
# MAGIC # 1. Preflight: governed sample data
# MAGIC
# MAGIC Writes `gc_customers`, `gc_products` and `gc_orders` to Unity Catalog with the sample-data generator and a fixed seed, then prints row counts. Each table gets a comment, because Genie Code reads table and column metadata.
# MAGIC
# MAGIC Safe to rerun: every table uses `CREATE OR REPLACE TABLE`, so a rerun gives the same rows.
# MAGIC
# MAGIC ## Required setup
# MAGIC
# MAGIC `USE CATALOG`, `USE SCHEMA` and `CREATE TABLE` on the schema. Serverless compute. Nothing is created at account level.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_genie_code", ['catalog', 'schema'])
catalog, schema = params["catalog"], params["schema"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the tables

# COMMAND ----------

from analyst_common.genie_code import SAMPLE_SPEC, SEED, fq
from sample_data import generate

COMMENTS = {
    "gc_customers": "Guide sample: one row per customer. Grain: customer_id.",
    "gc_products": "Guide sample: one row per product. Grain: product_id.",
    "gc_orders": "Guide sample: one row per order. Grain: order_id. status is completed, shipped, cancelled or returned.",
}

counts = {}
for name, table in SAMPLE_SPEC.items():
    df = generate(spark, table["columns"], rows=table["rows"], seed=SEED, name=name)
    df.createOrReplaceTempView(f"_{name}_tmp")
    target = fq(catalog, schema, name)
    spark.sql(f"CREATE OR REPLACE TABLE {target} AS SELECT * FROM _{name}_tmp")
    spark.sql(f"COMMENT ON TABLE {target} IS '{COMMENTS[name]}'")
    counts[name] = spark.table(target).count()
    print(f"{target}: {counts[name]} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Row counts and revenue to expect
# MAGIC
# MAGIC The gold tables you build in Steps 1 to 3 must reconcile to these numbers.

# COMMAND ----------

row = spark.sql(f"""
SELECT COUNT(*) AS revenue_orders, CAST(SUM(quantity * unit_price) AS DECIMAL(18, 2)) AS revenue
FROM {fq(catalog, schema, 'gc_orders')} WHERE status IN ('completed', 'shipped')
""").first()
print(f"Orders that count as revenue: {row.revenue_orders}, revenue {row.revenue}")
display(spark.createDataFrame([(k, v) for k, v in counts.items()], "table string, row_count long"))
