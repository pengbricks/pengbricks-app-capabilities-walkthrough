# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Seed the environment
# MAGIC
# MAGIC Tags the environment schema with `environment=<env>` (a governed tag policy that limits the allowed values makes the notebook print the refusal and carry on) and, in every environment except prod, loads 50 generated orders into `sample_orders`. Prod keeps no generated data: real data belongs there, and nothing else does. A rerun replaces the table, so the row count stays at 50.
# MAGIC
# MAGIC The last cell prints the three-level name one sales table gets in each of the three layouts.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_environments", ['catalog', 'schema', 'environment'])

# COMMAND ----------

from layout_lib import ENVIRONMENTS, three_level_name

catalog, schema, environment = params["catalog"], params["schema"], params["environment"]
if environment not in ENVIRONMENTS:
    raise ValueError(f"environment must be one of {ENVIRONMENTS}, got {environment!r}")
target = f"`{catalog}`.`{schema}`"

# COMMAND ----------

# MAGIC %md
# MAGIC ## The task

# COMMAND ----------

try:
    spark.sql(f"ALTER SCHEMA {target} SET TAGS ('environment' = '{environment}')")
    print(f"Tagged {catalog}.{schema} with environment={environment}")
except Exception as error:
    # A governed tag policy on `environment` can limit its values (for example dev, staging, prod), so test or stage is refused.
    print(f"Could not tag {catalog}.{schema}: {str(error).splitlines()[0][:300]}")

if environment == "prod":
    print("prod: no generated data. Real data lands here from prod sources only.")
else:
    spark.sql(
        f"""
        CREATE OR REPLACE TABLE {target}.sample_orders AS
        SELECT id AS order_id,
               concat('C', lpad(cast(id % 12 AS string), 3, '0')) AS customer_id,
               round((id % 7 + 1) * 12.5, 2) AS amount,
               date_add(DATE'2026-01-01', cast(id % 30 AS int)) AS order_date
        FROM range(1, 51)
        """
    )
    print(f"{catalog}.{schema}.sample_orders: {spark.table(f'{target}.sample_orders').count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## The same table in each layout

# COMMAND ----------

print(f"{'environment':<12}{'(a) catalog per env':<38}{'(b) catalog per env + domain':<40}(c) one catalog")
for env in ENVIRONMENTS:
    print(f"{env:<12}{three_level_name('a', env):<38}{three_level_name('b', env):<40}{three_level_name('c', env)}")
print(f"\nThis target writes to {catalog}.{schema}.*, which is layout (c) with the environment in the schema name.")
