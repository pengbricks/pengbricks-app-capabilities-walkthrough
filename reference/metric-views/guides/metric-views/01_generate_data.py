# Databricks notebook source
# MAGIC %md
# MAGIC # 1. Generate the sample tables
# MAGIC
# MAGIC Writes four small synthetic tables: `mv_customers` (240), `mv_products` (24), `mv_orders` (4,000, with some cancelled and returned), and `mv_sessions` (site visits, some of which end in a purchase). The generator in `src/mv_lib.py` uses fixed seeds, so every run writes the same rows.
# MAGIC
# MAGIC Safe to rerun: the schema is created only if missing and every table is replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_metric_views", ['catalog', 'schema'])
catalog, schema = params["catalog"], params["schema"]

import mv_lib as m

# The bundle's schema comes from the foundation bundle; creating it here lets the folder run by hand in a fresh catalog.
spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{catalog}`.`{schema}`")
T = {key: m.fq(catalog, schema, name) for key, name in m.TABLES.items()}

# COMMAND ----------

def overwrite(rows, columns, table):
    spark.createDataFrame(rows, columns).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)

customers = m.make_customers()
products = m.make_products()
orders = m.make_orders(customers, products)
sessions = m.make_sessions(customers)

overwrite(customers, "customer_id string, customer_name string, segment string, region string, signup_date date", T["customers"])
overwrite(products, "product_id string, product_name string, category string, list_price double", T["products"])
overwrite(orders, "order_id string, customer_id string, product_id string, order_date date, quantity int, unit_price double, discount_pct double, order_status string, channel string", T["orders"])
overwrite(sessions, "session_id string, customer_id string, session_date date, channel string, converted boolean", T["sessions"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## What goes in
# MAGIC
# MAGIC `mv_orders` has one row per order. `order_status` is `completed`, `cancelled`, or `returned`; the orders metric view keeps only `completed` rows, so the hand-written checks in step 4 apply the same rule. Revenue is `quantity * unit_price * (1 - discount_pct)`.

# COMMAND ----------

display(spark.table(T["orders"]).orderBy("order_id").limit(20))

# COMMAND ----------

display(spark.sql(f"""
    SELECT 'mv_customers' AS table_name, count(*) AS row_count FROM {T['customers']}
    UNION ALL SELECT 'mv_products', count(*) FROM {T['products']}
    UNION ALL SELECT 'mv_orders', count(*) FROM {T['orders']}
    UNION ALL SELECT 'mv_sessions', count(*) FROM {T['sessions']}
"""))
