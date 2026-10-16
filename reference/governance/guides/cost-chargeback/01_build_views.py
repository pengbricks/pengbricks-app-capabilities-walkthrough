# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Build the usage view
# MAGIC
# MAGIC Joins `system.billing.usage` with list prices into `cost_usage_enriched`, scoped to this workspace, with the guide tags, user and job attached.

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

def build_views(args, spark) -> None:
    """Usage x list price, scoped to this workspace. The shared system tables hold every workspace."""
    wid = workspace_id()
    spark.sql(f"""CREATE OR REPLACE VIEW {q(args, VIEW)} AS
        SELECT u.usage_date, u.sku_name, u.billing_origin_product AS product, u.usage_unit,
               u.custom_tags['capability_guide_job'] AS guide_job,
               u.custom_tags['capability_guide_use_case'] AS use_case,
               coalesce(u.identity_metadata.run_as, u.identity_metadata.created_by, u.identity_metadata.owned_by, 'unattributed') AS usage_user,
               u.usage_metadata.job_id AS job_id, u.usage_metadata.job_run_id AS job_run_id,
               u.usage_metadata.job_name AS job_name, u.usage_metadata.dlt_pipeline_id AS pipeline_id,
               u.usage_metadata.warehouse_id AS warehouse_id,
               u.usage_quantity, p.pricing.default AS list_price,
               u.usage_quantity * p.pricing.default AS cost_usd
        FROM system.billing.usage u
        LEFT JOIN system.billing.list_prices p
          ON u.sku_name = p.sku_name AND u.cloud = p.cloud AND p.currency_code = 'USD'
         AND u.usage_end_time >= p.price_start_time AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)
        WHERE u.workspace_id = '{wid}' AND u.usage_date >= date_sub(current_date(), 90)""")
    row = spark.sql(f"SELECT count(*) AS n, round(sum(cost_usd), 2) AS usd, min(usage_date) AS first_day FROM {q(args, VIEW)}").first()
    print(f"{VIEW}: {row['n']} usage rows, ${row['usd']} at list price since {row['first_day']}")
    assert row["n"] > 0

# COMMAND ----------

build_views(args, spark)
