# Databricks notebook source
# MAGIC %md
# MAGIC # 2. SQL exploration
# MAGIC
# MAGIC Three analyses over the governed `analyst_orders`, `analyst_customers` and `analyst_products` tables. Each is saved as a table so the run leaves artifacts you can open. `CREATE OR REPLACE` makes a rerun replace each one.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_sql_notebooks", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Revenue by region and segment, with each group's share of the total

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {fq}.sql_revenue_by_region AS
SELECT c.region,
       c.segment,
       COUNT(*) AS orders,
       SUM(o.quantity * o.unit_price) AS revenue,
       ROUND(100 * SUM(o.quantity * o.unit_price) / SUM(SUM(o.quantity * o.unit_price)) OVER (), 2) AS pct_of_total
FROM {fq}.analyst_orders o JOIN {fq}.analyst_customers c USING (customer_id)
WHERE o.status IN ('completed', 'shipped')
GROUP BY c.region, c.segment
""")
display(spark.table(f"{fq}.sql_revenue_by_region").orderBy("region", "segment"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Top 20 customers by revenue, ranked inside their region

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {fq}.sql_top_customers AS
WITH revenue AS (
  SELECT c.customer_id, c.region, SUM(o.quantity * o.unit_price) AS revenue
  FROM {fq}.analyst_orders o JOIN {fq}.analyst_customers c USING (customer_id)
  WHERE o.status IN ('completed', 'shipped')
  GROUP BY c.customer_id, c.region
)
SELECT *, RANK() OVER (PARTITION BY region ORDER BY revenue DESC) AS rank_in_region
FROM revenue
QUALIFY RANK() OVER (ORDER BY revenue DESC) <= 20
""")
display(spark.table(f"{fq}.sql_top_customers").orderBy("region", "rank_in_region"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Monthly revenue with a running total and month-over-month change

# COMMAND ----------

spark.sql(f"""
CREATE OR REPLACE TABLE {fq}.sql_monthly_running_total AS
WITH monthly AS (
  SELECT DATE_TRUNC('MONTH', order_ts) AS month, SUM(quantity * unit_price) AS revenue
  FROM {fq}.analyst_orders
  WHERE status IN ('completed', 'shipped')
  GROUP BY 1
)
SELECT month,
       revenue,
       SUM(revenue) OVER (ORDER BY month) AS running_revenue,
       ROUND(100 * (revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month), 2) AS mom_pct
FROM monthly
""")
display(spark.table(f"{fq}.sql_monthly_running_total").orderBy("month"))
