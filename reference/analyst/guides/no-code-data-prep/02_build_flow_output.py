# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Build the flow output with SQL
# MAGIC
# MAGIC The same steps a Lakeflow Designer flow performs in the UI: browse, filter, join, rename, derive, save. Safe to rerun: both tables use `CREATE OR REPLACE`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_no_code_prep", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Filter, join, rename and derive

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {fq}.prep_flow_output AS
SELECT o.order_id                                        AS order_number,
       o.customer_id                                     AS customer_id,
       c.region                                          AS sales_region,
       c.segment                                         AS customer_segment,
       DATE(o.order_ts)                                  AS order_date,
       o.quantity,
       o.unit_price,
       CAST(o.quantity * o.unit_price AS DECIMAL(12, 2)) AS order_total,
       CASE WHEN o.quantity * o.unit_price >= 1000 THEN 'large' ELSE 'standard' END AS order_size
FROM {fq}.analyst_orders o
JOIN {fq}.analyst_customers c ON o.customer_id = c.customer_id
WHERE o.status = 'completed'
  AND o.order_ts >= '2026-01-01'
""")
display(spark.table(f"{fq}.prep_flow_output").limit(10))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summarize the output
# MAGIC
# MAGIC Compare these three numbers with the Designer flow's result.

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {fq}.prep_flow_summary AS
SELECT COUNT(*) AS output_rows, SUM(order_total) AS output_total, COUNT(DISTINCT customer_id) AS customers
FROM {fq}.prep_flow_output
""")
display(spark.table(f"{fq}.prep_flow_summary"))
