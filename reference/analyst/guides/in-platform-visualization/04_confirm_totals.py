# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Confirm the totals match
# MAGIC
# MAGIC Runs the published dashboard's own dataset queries and compares their totals with the views and with the totals the notebook charts plotted. Run `03_notebook_charts` first.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_visualization", ['catalog', 'schema', 'use_case', 'warehouse_id', 'dashboard_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the dashboard is published and load its dataset queries

# COMMAND ----------

import json
from databricks.sdk import WorkspaceClient
from analyst_common.helpers import totals_match

w = WorkspaceClient()
published = w.lakeview.get_published(params["dashboard_id"])
print(f"Dashboard published, warehouse {published.warehouse_id}")

dashboard_file = ROOT / "src" / "dashboards" / "visualization.lvdash.json"
with open(dashboard_file, encoding="utf-8") as handle:
    datasets = {d["name"]: " ".join(d["queryLines"]) for d in json.load(handle)["datasets"]}

def scalar(query: str) -> str:
    result = w.statement_execution.execute_statement(
        statement=query, warehouse_id=params["warehouse_id"], catalog=catalog, schema=schema, wait_timeout="50s"
    )
    if result.status.state.value != "SUCCEEDED":
        raise Exception(f"Query failed: {result.status}")
    return result.result.data_array[0][0]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Compare dashboard, view and chart totals

# COMMAND ----------

notebook = {r["view_name"]: r["total_revenue"] for r in spark.table(f"{fq}.chart_totals").collect()}
rows = []
for dataset, view in (("ds_monthly", "v_revenue_by_month"), ("ds_region_segment", "v_revenue_by_region_segment")):
    dashboard_total = scalar(f"SELECT SUM(revenue) FROM ({datasets[dataset]}) t")
    view_total = scalar(f"SELECT SUM(revenue) FROM {view}")
    chart_total = notebook[view]
    ok = totals_match(dashboard_total, view_total) and totals_match(dashboard_total, chart_total)
    print(f"{view}: dashboard {dashboard_total}, view {view_total}, notebook chart {chart_total}, match {ok}")
    rows.append((view, str(dashboard_total), str(view_total), str(chart_total), ok, params["run_id"]))

spark.createDataFrame(
    rows, "view_name STRING, dashboard_total STRING, view_total STRING, notebook_total STRING, totals_match BOOLEAN, run_id STRING"
).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.totals_check")
display(spark.table(f"{fq}.totals_check"))
if not all(r[4] for r in rows):
    raise Exception("Dashboard and notebook totals differ")
