# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Spend breakdown
# MAGIC
# MAGIC Writes spend by product, SKU, tag, user, job, pipeline and day as tables, each replaced on every run.

# MAGIC
# MAGIC Safe to rerun: each breakdown table is created with `CREATE OR REPLACE`.
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

def spend_breakdown(args, spark) -> None:
    window = "usage_date >= date_sub(current_date(), 30)"
    queries = {
        "cost_by_product": f"SELECT product, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} WHERE {window} GROUP BY product ORDER BY cost_usd DESC",
        "cost_by_sku": f"SELECT product, sku_name, round(sum(usage_quantity), 2) AS usage_quantity, usage_unit, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} WHERE {window} GROUP BY product, sku_name, usage_unit ORDER BY cost_usd DESC",
        "cost_by_tag": f"""SELECT coalesce(guide_job, '(untagged)') AS guide_job, coalesce(use_case, '(untagged)') AS use_case,
                                  round(sum(cost_usd), 2) AS cost_usd
                           FROM {q(args, VIEW)} WHERE {window} GROUP BY 1, 2 ORDER BY cost_usd DESC""",
        "cost_by_user": f"SELECT usage_user, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} WHERE {window} GROUP BY usage_user ORDER BY cost_usd DESC",
        "cost_by_job": f"""SELECT job_id, max(job_name) AS job_name, count(DISTINCT job_run_id) AS runs, round(sum(cost_usd), 2) AS cost_usd
                           FROM {q(args, VIEW)} WHERE {window} AND job_id IS NOT NULL GROUP BY job_id ORDER BY cost_usd DESC""",
        "cost_by_pipeline": f"SELECT pipeline_id, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} WHERE {window} AND pipeline_id IS NOT NULL GROUP BY pipeline_id ORDER BY cost_usd DESC",
        "cost_daily": f"SELECT usage_date, round(sum(cost_usd), 2) AS cost_usd FROM {q(args, VIEW)} GROUP BY usage_date ORDER BY usage_date",
    }
    for name, statement in queries.items():
        spark.sql(f"CREATE OR REPLACE TABLE {q(args, name)} AS {statement}")
        top = spark.sql(f"SELECT * FROM {q(args, name)} LIMIT 3").collect()
        print(name, [r.asDict() for r in top])
    tagged = spark.sql(f"SELECT count(*) AS n FROM {q(args, 'cost_by_tag')} WHERE guide_job <> '(untagged)'").first()["n"]
    assert tagged > 0, "no spend carries the capability_guide_job tag"

# COMMAND ----------

spend_breakdown(args, spark)
