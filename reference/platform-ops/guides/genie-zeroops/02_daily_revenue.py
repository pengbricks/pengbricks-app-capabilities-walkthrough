# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Daily revenue
# MAGIC
# MAGIC Reads `zo_orders` and writes daily revenue to `zo_daily_revenue`, summing the column named by `amount_column`.
# MAGIC
# MAGIC - `amount` (the default) is the healthy run.
# MAGIC - `amout` is the deliberate break. The column does not exist, so the query fails with an unresolved-column error. That failure is what Genie ZeroOps (private preview) investigates.
# MAGIC
# MAGIC The name must be a plain identifier. Anything else is rejected before it reaches SQL, so the break stays a column typo.
# MAGIC
# MAGIC Required setup: run `01_prepare_data` first.
# MAGIC
# MAGIC Safe to rerun: `CREATE OR REPLACE TABLE` replaces `zo_daily_revenue`. A failed run leaves the previous version in place.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from zeroops_lib import daily_revenue_sql, run_mode

params = load_params(dbutils, "capability_guides_zeroops_demo", ["catalog", "schema", "amount_column"], defaults={"amount_column": "amount"})
catalog, schema, amount_column = params["catalog"], params["schema"], params["amount_column"]

# COMMAND ----------

mode = run_mode(amount_column)
print("=" * 60)
if mode == "healthy":
    print(f"MODE: HEALTHY. Summing '{amount_column}'. This run should succeed.")
else:
    print(f"MODE: DELIBERATE BREAK. Summing '{amount_column}', which is not a column of zo_orders.")
    print("This run is expected to fail with an unresolved-column error.")
print("=" * 60)

# COMMAND ----------

source = f"{catalog}.{schema}.zo_orders"
target = f"{catalog}.{schema}.zo_daily_revenue"
spark.sql(daily_revenue_sql(source, target, amount_column))
print(f"{target}: {spark.table(target).count()} days of revenue")
