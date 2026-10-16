# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Check the forecast
# MAGIC
# MAGIC Reads back `cost_forecast_30d`, which the SQL task `04_forecast.sql` writes with `ai_forecast`, and asserts at least 30 forecast days.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_cost", ['catalog', 'schema', 'budget_threshold_usd'])

# COMMAND ----------

import datetime as dt
from types import SimpleNamespace
from common import run_sql_rows, workspace_id, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import grant_sql, principal_kind, qualified

args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    threshold=params["budget_threshold_usd"],
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

VIEW = "cost_usage_enriched"

def q(args, name: str) -> str:
    return qualified(args.catalog, args.schema, name)

def check_forecast(args, spark) -> None:
    """Read back the forecast table written by sql/cost_forecast.sql."""
    row = spark.sql(f"""SELECT count(*) AS days, min(ds) AS first_day, max(ds) AS last_day, round(sum(cost_forecast_usd), 2) AS total,
                               round(sum(cost_lower_usd), 2) AS low, round(sum(cost_upper_usd), 2) AS high,
                               (SELECT count(*) FROM {q(args, 'cost_daily')}) AS history_days
                        FROM {q(args, 'cost_forecast_30d')}""").first()
    print(row.asDict())
    assert row["days"] >= 30, row
    assert row["total"] is not None

# COMMAND ----------

check_forecast(args, spark)
