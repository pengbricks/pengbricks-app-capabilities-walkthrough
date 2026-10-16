# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Create the governed views
# MAGIC
# MAGIC Two views over completed and shipped orders. The notebook charts and the AI/BI dashboard both read them, so the numbers can be compared. `CREATE OR REPLACE` makes a rerun replace them.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_visualization", ['catalog', 'schema', 'use_case', 'warehouse_id', 'dashboard_id'])
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Revenue by month

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE VIEW {fq}.v_revenue_by_month
COMMENT 'Revenue and order count per month for completed and shipped orders'
AS
SELECT CAST(DATE_TRUNC('MONTH', order_ts) AS DATE) AS month,
       COUNT(*) AS orders,
       CAST(SUM(quantity * unit_price) AS DECIMAL(18, 2)) AS revenue
FROM {fq}.analyst_orders
WHERE status IN ('completed', 'shipped')
GROUP BY 1
""")
display(spark.table(f"{fq}.v_revenue_by_month").orderBy("month"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Revenue by region and segment

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE VIEW {fq}.v_revenue_by_region_segment
COMMENT 'Revenue and order count per customer region and segment for completed and shipped orders'
AS
SELECT c.region,
       c.segment,
       COUNT(*) AS orders,
       CAST(SUM(o.quantity * o.unit_price) AS DECIMAL(18, 2)) AS revenue
FROM {fq}.analyst_orders o JOIN {fq}.analyst_customers c USING (customer_id)
WHERE o.status IN ('completed', 'shipped')
GROUP BY c.region, c.segment
""")
display(spark.table(f"{fq}.v_revenue_by_region_segment"))
