# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Check the outputs
# MAGIC
# MAGIC Checks that the silver and gold tables from the prompts exist, reconcile to the sample, and sit at the stated grain. Lists notebooks, other workspace objects, and dashboards whose names start with `gc_`. Status is `complete`, `incomplete`, or `needs_manual_check` when a listing could not confirm an asset (the docs do not say how a Designer file shows in a workspace listing).
# MAGIC
# MAGIC This notebook never fails because a step is missing. It prints what is missing and how to make it, then exits with a summary. Safe to rerun: it only reads.
# MAGIC
# MAGIC ## Required setup
# MAGIC
# MAGIC `USE SCHEMA` and `SELECT` on the schema. Listing dashboards and notebooks uses your own workspace permissions, so you see only what you can see.

# COMMAND ----------

import sys, os, json
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_genie_code", ['catalog', 'schema'])
catalog, schema = params["catalog"], params["schema"]

from analyst_common.genie_code import (
    DASHBOARD_NAME, DESIGNER_FLOW_NAME, GOLD_TABLES, NOTEBOOK_NAME, PREFIX, REVENUE_STATUSES, SILVER_TABLE,
    expected_tables, filter_assets, fq, grain_duplicates, howto_for_missing, missing_tables, reconcile, unverified_steps,
)

problems = []

# COMMAND ----------

# MAGIC %md
# MAGIC ## Which tables exist

# COMMAND ----------

existing = [r.tableName for r in spark.sql(f"SHOW TABLES IN {catalog}.{schema}").collect()]
absent = missing_tables(existing)
print("Expected:", ", ".join(expected_tables()))
print("Missing:", ", ".join(absent) or "none")
if absent:
    problems.append(f"Missing tables: {', '.join(absent)}. Sample tables come from 01_preflight_sample_data; the rest from Step 1 prompts.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Reconcile to the sample

# COMMAND ----------

def one(sql):
    return spark.sql(sql).first()[0]

statuses = ", ".join(f"'{s}'" for s in REVENUE_STATUSES)
if "gc_orders" not in absent:
    sample_rows = one(f"SELECT COUNT(*) FROM {fq(catalog, schema, 'gc_orders')} WHERE status IN ({statuses})")
    sample_total = one(f"SELECT CAST(SUM(quantity * unit_price) AS DECIMAL(18, 2)) FROM {fq(catalog, schema, 'gc_orders')} WHERE status IN ({statuses})")
    print(f"Sample: {sample_rows} revenue orders, revenue {sample_total}")

    if SILVER_TABLE not in absent:
        silver = fq(catalog, schema, SILVER_TABLE)
        silver_rows, silver_ids = spark.sql(f"SELECT COUNT(*), COUNT(DISTINCT order_id) FROM {silver}").first()
        silver_total = one(f"SELECT CAST(SUM(order_total) AS DECIMAL(18, 2)) FROM {silver}")
        print(f"Silver: {silver_rows} rows, revenue {silver_total}")
        if silver_rows != sample_rows:
            problems.append(f"{SILVER_TABLE} has {silver_rows} rows; the sample has {sample_rows} orders with status {statuses}.")
        if grain_duplicates(silver_rows, silver_ids):
            problems.append(f"{SILVER_TABLE} repeats an order_id: grain is one row per order.")

    if all(t not in absent for t in GOLD_TABLES):
        region_t, customer_t = (fq(catalog, schema, t) for t in GOLD_TABLES)
        region_total = one(f"SELECT CAST(SUM(revenue) AS DECIMAL(18, 2)) FROM {region_t}")
        customer_total = one(f"SELECT CAST(SUM(revenue) AS DECIMAL(18, 2)) FROM {customer_t}")
        print(f"Gold: sales by region and month {region_total}, customer value {customer_total}")
        problems += reconcile(sample_total, silver_total if SILVER_TABLE not in absent else sample_total, region_total, customer_total)

        rows, keys = spark.sql(f"SELECT COUNT(*), COUNT(DISTINCT order_month, region, category) FROM {region_t}").first()
        if grain_duplicates(rows, keys):
            problems.append(f"{GOLD_TABLES[0]} repeats an (order_month, region, category) key.")
        rows, keys = spark.sql(f"SELECT COUNT(*), COUNT(DISTINCT customer_id) FROM {customer_t}").first()
        if grain_duplicates(rows, keys):
            problems.append(f"{GOLD_TABLES[1]} repeats a customer_id.")
else:
    print("gc_orders is missing, so nothing can reconcile. Run 01_preflight_sample_data.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Notebooks and dashboards named `gc_`
# MAGIC
# MAGIC These come from the interactive steps. The listing uses your permissions.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()

notebooks, dashboards, other_assets = [], [], []
notebooks_listed = dashboards_listed = False
try:
    home = f"/Users/{w.current_user.me().user_name}"
    seen = 0
    for obj in w.workspace.list(home, recursive=True):
        seen += 1
        if seen > 20000:
            print("Stopped listing after 20000 objects.")
            break
        if str(obj.object_type).endswith(("NOTEBOOK", "FILE")):
            notebooks.append(obj.path)
        else:
            other_assets.append(obj.path)  # a Designer file may be listed under another object type
    notebooks = filter_assets(notebooks)
    other_assets = filter_assets(other_assets)
    notebooks_listed = True
except Exception as e:
    print(f"Could not list notebooks: {e}")
try:
    dashboards = filter_assets(d.display_name for d in w.lakeview.list() if d.display_name)
    dashboards_listed = True
except Exception as e:
    print(f"Could not list dashboards: {e}")

print("Notebooks:", notebooks or "none")
print("Other gc_ workspace objects:", other_assets or "none")
print("Dashboards:", dashboards or "none")

# The docs do not say how a Designer file appears in a workspace listing, so match its name in any object type.
# If the name is not found but its three output tables exist, the flow ran: report it as unverified, not missing.
flow_by_name = any(DESIGNER_FLOW_NAME in n for n in notebooks + other_assets)
outputs_exist = all(t not in absent for t in (SILVER_TABLE, *GOLD_TABLES))
has_flow = True if flow_by_name else (None if (outputs_exist or not notebooks_listed) else False)
found_notebook = any(NOTEBOOK_NAME in n for n in notebooks)
found_dashboard = any(DASHBOARD_NAME in d for d in dashboards) or any(DASHBOARD_NAME in n for n in other_assets)
has_notebook = True if found_notebook else (False if notebooks_listed else None)
has_dashboard = True if found_dashboard else (False if dashboards_listed else None)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary

# COMMAND ----------

todo = howto_for_missing(has_flow, has_notebook, has_dashboard)
unverified = unverified_steps(has_flow, has_notebook, has_dashboard)
status = "incomplete" if problems or todo else "needs_manual_check" if unverified else "complete"
print(f"Status: {status}")
for line in problems + todo + unverified:
    print(" -", line)
dbutils.notebook.exit(json.dumps({"status": status, "problems": problems, "todo": todo, "unverified": unverified}))
