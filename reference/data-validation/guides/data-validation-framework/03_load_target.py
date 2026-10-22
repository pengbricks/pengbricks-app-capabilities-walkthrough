# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Load the target
# MAGIC
# MAGIC Safe to rerun: the landed tables are overwritten, and the late source change is undone before each copy so every run copies the same source. Copies `orders` and `customers` from the source into Delta tables with `remote_query`. These tables play the bronze role: a faithful copy that the pipeline cleans and the checks compare with the source. Each table is overwritten, so a rerun replaces it.
# MAGIC
# MAGIC After the copy, the notebook changes the source the way a late correction would: it moves six orders from one day to the previous day. Whole-table count and sum do not change. Only a per-day comparison can see it.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_data_validation", ['catalog', 'schema', 'use_case', 'lakebase_project', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

import dv_lib
from databricks.sdk import WorkspaceClient

spec = dv_lib.load_spec(SPEC_FILE)
cfg = {**spec["source"], **({"lakebase_project": params["lakebase_project"]} if params["lakebase_project"] else {})}
src = dv_lib.ident(cfg["schema"])
dv_lib.restore_late_change(WorkspaceClient(), cfg, spec)  # a rerun copies the original source, not the moved one
def remote(sql: str):
    return dv_lib.remote_query(spark, cfg["connection_name"], cfg["lakebase_database"], sql)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Copy the tables

# COMMAND ----------

remote(f"SELECT customer_id, name, segment FROM {src}.customers").selectExpr(
    "CAST(customer_id AS INT) AS customer_id", "name", "segment", "current_timestamp() AS _loaded_at"
).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{ns}.dv_customers_landed")

remote(f"SELECT order_id, customer_id, order_date, status, amount FROM {src}.orders").selectExpr(
    "CAST(order_id AS INT) AS order_id", "CAST(customer_id AS INT) AS customer_id", "CAST(order_date AS DATE) AS order_date",
    "status", "CAST(amount AS DECIMAL(12,2)) AS amount", "current_timestamp() AS _loaded_at",
).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{ns}.dv_orders_landed")

for table in ("dv_customers_landed", "dv_orders_landed"):
    print(f"{table}: {spark.table(f'{ns}.{table}').count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Change the source after the copy

# COMMAND ----------

change = spec["data"]["late_change"]
ids = dv_lib.late_change_ids(spec)
with dv_lib.connect(dv_lib.connection_settings(WorkspaceClient(), cfg)) as conn, conn.cursor() as cur:
    cur.execute(
        f"UPDATE {src}.orders SET order_date = order_date - %s WHERE order_id = ANY(%s)",
        (change["to_day_offset"] - change["from_day_offset"], ids),
    )
    print(f"Moved {cur.rowcount} source orders from {change['from_day_offset']} to {change['to_day_offset']} days ago: {ids}")
    assert cur.rowcount == len(ids)
