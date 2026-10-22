# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Budget check
# MAGIC
# MAGIC Records the 7-day list-price spend against the budget threshold in `budget_status`. The SQL alert in the bundle uses the same query.

# MAGIC
# MAGIC Safe to rerun: `budget_status` is replaced, so it holds one row for the latest check.
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
from governance_lib.analysis import over_budget

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

def budget_check(args, spark) -> None:
    """Record the 7-day spend against the threshold. The same query backs the SQL alert in the bundle."""
    spend = float(spark.sql(f"""SELECT coalesce(sum(cost_usd), 0) AS s FROM {q(args, VIEW)}
                                WHERE usage_date >= date_sub(current_date(), 7)""").first()["s"])
    threshold = float(args.threshold)
    # Mechanisms: a SQL alert (resources/budget.alert.yml). Record whether the account budgets API answers.
    mechanism = "SQL alert on 7-day list-price spend"
    try:
        from databricks.sdk import WorkspaceClient

        w = WorkspaceClient()
        w.api_client.do("GET", f"/api/2.1/accounts/{w.config.account_id or 'unknown'}/budgets")
        policy_note = "account budgets API reachable"
    except Exception as exc:  # noqa: BLE001
        policy_note = f"account budgets API not reachable from the workspace ({type(exc).__name__})"
    rows = [{"checked_at": dt.datetime.now(dt.timezone.utc).replace(tzinfo=None), "spend_7d_usd": round(spend, 2),
             "threshold_usd": threshold, "breached": over_budget(spend, threshold), "mechanism": mechanism, "note": policy_note}]
    write_rows(spark, args.catalog, args.schema, "budget_status", rows,
               "checked_at timestamp, spend_7d_usd double, threshold_usd double, breached boolean, mechanism string, note string")
    print(rows[0])

# COMMAND ----------

budget_check(args, spark)
