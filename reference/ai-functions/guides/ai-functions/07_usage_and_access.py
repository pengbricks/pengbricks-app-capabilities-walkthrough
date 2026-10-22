# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 7. Check access and usage
# MAGIC
# MAGIC Reads who can call the AI Functions (`SHOW GRANTS ON SCHEMA system.ai`) and saves it to `aif_system_ai_grants`. Nothing is revoked: changing the grants affects every user in the metastore. Then it reads the last 30 days of AI Functions and Model Serving usage from `system.billing.usage`. Usage lands in the system table hours after a call, so this run's own calls may not show yet. Safe to rerun: the grants table is overwritten, nothing is revoked, and the step's rows in `aif_results` are swapped, not added.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
spec = a.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
grants_table = a.fq(catalog, schema, "aif_system_ai_grants")

# COMMAND ----------

from pyspark.sql import functions as F

rows = []
try:
    grants = spark.sql("SHOW GRANTS ON SCHEMA system.ai")
    grants.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(grants_table)
    display(grants)
    execute = [r for r in grants.collect() if r.ActionType == "EXECUTE"]
    rows.append(("execute_grants", len(execute), ", ".join(sorted(r.Principal for r in execute))))
except Exception as exc:  # noqa: BLE001 - record what the identity could not read
    rows.append(("execute_grants", -1, f"could not read grants: {type(exc).__name__}"))

# COMMAND ----------

try:
    usage = spark.sql("""
        SELECT billing_origin_product AS product, usage_unit, round(sum(usage_quantity), 3) AS quantity,
               min(usage_date) AS first_day, max(usage_date) AS last_day
        FROM system.billing.usage
        WHERE billing_origin_product IN ('AI_FUNCTIONS', 'MODEL_SERVING')
          AND usage_date >= current_date() - INTERVAL 30 DAYS
        GROUP BY ALL ORDER BY product
    """)
    display(usage)
    for r in usage.collect():
        rows.append((f"usage_30d_{r.product.lower()}", float(r.quantity), f"{r.usage_unit}, {r.first_day} to {r.last_day}"))
except Exception as exc:  # noqa: BLE001
    rows.append(("usage_30d", -1, f"could not read system.billing.usage: {type(exc).__name__}"))

a.write_results(spark, T["results"], "access", rows, params["run_id"])
display(spark.table(T["results"]).orderBy("step", "metric"))
