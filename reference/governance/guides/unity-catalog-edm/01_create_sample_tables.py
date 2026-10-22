# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Create the sample tables
# MAGIC
# MAGIC Creates three Delta tables in the shared schema: `edm_customers` (with sensitive columns), `edm_orders`, and `edm_customer_revenue_gold`, which joins them. Adds table and column comments, and records the row counts that the policy test in step 3 compares against.
# MAGIC
# MAGIC Safe to rerun: tables are dropped with `IF EXISTS` and rebuilt from fixed formulas, so the counts never change. A leftover policy on a table is dropped first, because a table that carries one cannot be replaced in place.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_unity_catalog_edm", ['catalog', 'schema'])

# COMMAND ----------

from types import SimpleNamespace
from governance_lib.sqlgen import qualified
from governance_lib import edm

args = SimpleNamespace(catalog=params["catalog"], schema=params["schema"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

def create_sample_tables(args, spark) -> None:
    """Build the customers, orders, and gold tables, add comments, and record baseline counts."""
    q = lambda name: qualified(args.catalog, args.schema, name)  # noqa: E731
    # A table with an attached policy, mask, or row filter cannot be replaced in place: clear it first.
    if spark.catalog.tableExists(q(edm.CUSTOMERS)):
        for policy in (edm.MASK_POLICY, edm.REGION_POLICY):
            try:
                spark.sql(edm.drop_policy_sql(policy, q(edm.CUSTOMERS)))
            except Exception as exc:  # noqa: BLE001
                print(f"could not drop policy {policy} ({type(exc).__name__}); dropping the table anyway")
    for table in (edm.GOLD, edm.ORDERS, edm.CUSTOMERS):
        spark.sql(f"DROP TABLE IF EXISTS {q(table)}")

    spark.sql(f"""CREATE TABLE {q(edm.CUSTOMERS)} AS
        SELECT concat('CUST-', lpad(cast(id AS STRING), 6, '0')) AS customer_id,
               concat('Customer ', lpad(cast(id AS STRING), 6, '0')) AS customer_name,
               concat('user', lpad(cast(id AS STRING), 6, '0'), '@example.com') AS email,
               concat(lpad(cast((id * 7919) % 900 + 100 AS STRING), 3, '0'), '-', lpad(cast(id % 99 + 1 AS STRING), 2, '0'),
                      '-', lpad(cast((id * 31) % 10000 AS STRING), 4, '0')) AS national_id,
               element_at(array('NA', 'EMEA', 'APAC', 'LATAM'), cast(id % 4 AS INT) + 1) AS region,
               element_at(array('consumer', 'business', 'enterprise'), cast(id % 3 AS INT) + 1) AS segment
        FROM range(1000)""")
    spark.sql(f"""CREATE TABLE {q(edm.ORDERS)} AS
        SELECT concat('ORD-', lpad(cast(id AS STRING), 8, '0')) AS order_id,
               concat('CUST-', lpad(cast(id % 1000 AS STRING), 6, '0')) AS customer_id,
               timestampadd(MINUTE, cast(id AS INT), timestamp'2026-07-01 00:00:00') AS order_ts,
               cast(5 + (id * 37) % 2495 AS DECIMAL(12, 2)) AS amount
        FROM range(4000)""")
    spark.sql(f"""CREATE TABLE {q(edm.GOLD)} AS
        SELECT c.customer_id, c.region, c.segment, count(*) AS order_count, sum(o.amount) AS revenue_usd
        FROM {q(edm.CUSTOMERS)} c JOIN {q(edm.ORDERS)} o USING (customer_id)
        GROUP BY c.customer_id, c.region, c.segment""")

    for table, comment in edm.TABLE_COMMENTS.items():
        spark.sql(edm.comment_sql(q(table), comment))
    for (table, column), comment in edm.COLUMN_COMMENTS.items():
        spark.sql(edm.comment_sql(q(table), comment, column))

    # Baseline taken before any policy exists: step 3 compares what the job identity sees against it.
    spark.sql(f"""CREATE OR REPLACE TABLE {q('edm_baseline_counts')} AS
        SELECT count(*) AS customers_total, count_if(region = '{edm.HIDDEN_REGION}') AS customers_hidden_region
        FROM {q(edm.CUSTOMERS)}""")
    for table in edm.SAMPLE_TABLES:
        print(table, spark.table(q(table)).count(), "rows")
    print(spark.table(q("edm_baseline_counts")).first().asDict())

# COMMAND ----------

create_sample_tables(args, spark)
