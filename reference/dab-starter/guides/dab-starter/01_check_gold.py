# Databricks notebook source
# MAGIC %md
# MAGIC # 1. Check the tables and the expectations
# MAGIC
# MAGIC Safe to rerun: it only reads the tables and the event log, and the pipeline generates the same orders from a fixed seed on every update.
# MAGIC
# MAGIC The pipeline has just updated. This notebook counts rows in bronze, silver, and gold and fails if they disagree: bronze must hold every generated order, silver can only hold fewer, and gold must count exactly the silver orders that are not cancelled. It then reads the pipeline's event log for the passed and failed rows of each expectation, and shows the top of the gold table.
# MAGIC
# MAGIC It only reads, so rerunning it changes nothing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
import dab_starter_lib as lib
params = load_params(dbutils, "capability_guides_dab_starter", ["catalog", "schema", "pipeline_id", "row_count"])
catalog, schema = params["catalog"], params["schema"]
table = lambda name: f"`{catalog}`.`{schema}`.{name}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Row counts across the layers

# COMMAND ----------

count = lambda sql: spark.sql(sql).first()[0]
bronze = count(f"SELECT count(*) FROM {table('orders_bronze')}")
silver = count(f"SELECT count(*) FROM {table('orders_silver')}")
silver_not_cancelled = count(f"SELECT count(*) FROM {table('orders_silver')} WHERE status <> 'cancelled'")
gold_orders = count(f"SELECT coalesce(sum(orders), 0) FROM {table('orders_daily_revenue')}")
gold_rows = count(f"SELECT count(*) FROM {table('orders_daily_revenue')}")

print(f"bronze: {bronze} rows")
print(f"silver: {silver} rows ({bronze - silver} dropped by expectations)")
print(f"gold:   {gold_rows} rows (day x category), {gold_orders} orders")

problems = lib.check_layers(int(params["row_count"]), bronze, silver, gold_orders, silver_not_cancelled)
assert not problems, "; ".join(problems)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Expectation results from the latest update

# COMMAND ----------

events = spark.sql(f"""
  SELECT details FROM event_log('{params["pipeline_id"]}')
  WHERE event_type = 'flow_progress'
    AND origin.update_id = (SELECT origin.update_id FROM event_log('{params["pipeline_id"]}')
                            WHERE event_type = 'create_update' ORDER BY timestamp DESC LIMIT 1)
""").collect()

results = lib.expectation_totals(row["details"] for row in events)
for item in results:
    print(f'{item["dataset"].split(".")[-1]}.{item["name"]}: {item["passed"]} passed, {item["failed"]} failed')
if not results:
    print("No expectation results in the event log yet.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Gold: the five busiest days

# COMMAND ----------

display(spark.sql(f"""
  SELECT order_date, sum(orders) AS orders, sum(units) AS units, round(sum(revenue), 2) AS revenue
  FROM {table('orders_daily_revenue')}
  GROUP BY order_date ORDER BY revenue DESC LIMIT 5
"""))
