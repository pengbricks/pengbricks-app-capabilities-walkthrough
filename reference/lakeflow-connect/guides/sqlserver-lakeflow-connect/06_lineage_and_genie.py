# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Lineage to silver, then ask Genie
# MAGIC
# MAGIC The silver pipeline (`silver/silver.sql`) builds three tables from bronze: current customers, plan history with validity windows, and orders joined to customer and product. Unity Catalog records the lineage from each bronze table to silver; this notebook reads it from `system.access.table_lineage`. Lineage system tables can lag by up to a few hours, so a first run may show fewer edges than Catalog Explorer.
# MAGIC
# MAGIC Then it creates or updates a Genie space over the silver tables, asks one business question, runs the SQL Genie wrote, and compares the answer with a hand-written query.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_lakeflow_connect", ["catalog", "schema", "warehouse_id", "run_id"], defaults={"run_id": "manual"})
catalog, schema = params["catalog"], params["schema"]

import lfc_lib as l
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
silver = [f"{catalog}.{schema}.{t}" for t in l.SILVER.values()]

# COMMAND ----------

lineage = spark.sql(f"""
  SELECT DISTINCT source_table_full_name AS source, target_table_full_name AS target, entity_type
  FROM system.access.table_lineage
  WHERE target_table_full_name IN ({','.join(f"'{t}'" for t in silver)})
    AND source_table_full_name IS NOT NULL
    AND event_date >= current_date() - INTERVAL 7 DAYS
  ORDER BY target, source""")
display(lineage)
edges = lineage.count()

# COMMAND ----------

title = f"Lakeflow Connect SQL Server orders ({schema})"
space_id = l.upsert_space(
    w, title, "Orders, customers, and plan history ingested from SQL Server with Lakeflow Connect.", params["warehouse_id"],
    l.serialized_space(
        [f"{catalog}.{schema}.{l.SILVER['orders']}", f"{catalog}.{schema}.{l.SILVER['customers']}", f"{catalog}.{schema}.{l.SILVER['plan_history']}"],
        "Revenue is the sum of amount. Exclude CANCELLED orders from revenue unless asked. plan_name is the customer's current plan.",
        ["Revenue by customer plan, excluding cancelled orders", "How many customers changed plan this month?"],
    ),
)
question = "What is the total revenue and number of orders for each customer plan, excluding cancelled orders?"
message = l.ask(w, space_id, question)
sql = l.generated_sql(message)
print(message.get("status"), f"{message['seconds']}s")
print(sql)

# COMMAND ----------

expected = [tuple(r) for r in spark.sql(f"""
  SELECT plan_name, sum(amount) AS revenue, count(*) AS orders
  FROM {catalog}.{schema}.{l.SILVER['orders']} WHERE status <> 'CANCELLED' GROUP BY plan_name""").collect()]
got = [tuple(r) for r in spark.sql(sql).collect()] if sql else []
# Genie may order or name the columns differently, so rows are compared by their values.
match = l.same_answer(expected, got)
if sql:
    display(spark.sql(sql))
print("Genie matches the hand-written query:", match)
print(f"{w.config.host.rstrip('/')}/genie/rooms/{space_id}")

l.write_results(spark, catalog, schema, params["run_id"], "lineage_and_genie", [
    ("lineage_edges_to_silver", edges, "system.access.table_lineage, last 7 days"),
    ("genie_answer_matches", int(match), question),
    ("genie_seconds", message["seconds"], space_id),
])
