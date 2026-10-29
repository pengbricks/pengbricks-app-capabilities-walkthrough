# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Confirm the running totals match
# MAGIC
# MAGIC The dashboard draws one running total four ways. This notebook checks the two that are plain SQL against a cumulative sum computed in Python from the monthly revenue:
# MAGIC
# MAGIC - the `ds_monthly_sql` dataset, which uses `SUM(revenue) OVER (ORDER BY order_month)`, and
# MAGIC - the metric view measures `revenue_running_total` (`range: cumulative`) and `revenue_trailing_3m` (`range: trailing 3 month inclusive`).
# MAGIC
# MAGIC The custom calculations (`AGGREGATE OVER`) run inside the dashboard engine, so no SQL query can call them. Their tiles sit next to the metric view tiles on the Running totals page, so you can compare them by eye. The Vega-Lite window transform runs in the browser.
# MAGIC
# MAGIC Run `02_viz_metric_view.sql` first. Safe to rerun: the check table is overwritten and nothing else is written.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_aibi_visualizations", ['catalog', 'schema', 'use_case', 'warehouse_id', 'dashboard_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the dashboard is published and load its dataset queries

# COMMAND ----------

import json
from databricks.sdk import WorkspaceClient
from analyst_common.helpers import running_totals, totals_match, trailing_sums

w = WorkspaceClient()
published = w.lakeview.get_published(params["dashboard_id"])
print(f"Dashboard published, warehouse {published.warehouse_id}")

dashboard_file = ROOT / "src" / "dashboards" / "aibi_visualizations.lvdash.json"
with open(dashboard_file, encoding="utf-8") as handle:
    dashboard = json.load(handle)
datasets = {d["name"]: "".join(d["queryLines"]) for d in dashboard["datasets"] if "queryLines" in d}
metric_view = next(d["asset_name"] for d in dashboard["datasets"] if d["name"] == "ds_metric_view")
print("Pages:", ", ".join(p["displayName"] for p in dashboard["pages"]))
print("Metric view dataset:", metric_view)


def rows(query: str) -> list[list[str]]:
    result = w.statement_execution.execute_statement(
        statement=query, warehouse_id=params["warehouse_id"], catalog=catalog, schema=schema, wait_timeout="50s"
    )
    if result.status.state.value != "SUCCEEDED":
        raise Exception(f"Query failed: {result.status}")
    return result.result.data_array or []

# COMMAND ----------

# MAGIC %md
# MAGIC ## Compute the running total by hand, then compare

# COMMAND ----------

sql_rows = rows(f"SELECT order_month, revenue, running_revenue FROM ({datasets['ds_monthly_sql']}) t ORDER BY order_month")
mv_rows = rows(
    f"SELECT order_month, MEASURE(revenue), MEASURE(revenue_running_total), MEASURE(revenue_trailing_3m) "
    f"FROM {metric_view} GROUP BY ALL ORDER BY order_month"
)
if [r[0] for r in sql_rows] != [r[0] for r in mv_rows]:
    raise Exception("The SQL dataset and the metric view return different months")

months = [r[0] for r in sql_rows]
expected_running = running_totals(r[1] for r in sql_rows)
expected_trailing = trailing_sums((r[1] for r in sql_rows), 3)

checks = []
for i, month in enumerate(months):
    checks.append((month, "sql_window_running_total", str(sql_rows[i][2]), str(expected_running[i])))
    checks.append((month, "metric_view_running_total", str(mv_rows[i][2]), str(expected_running[i])))
    checks.append((month, "metric_view_trailing_3m", str(mv_rows[i][3]), str(expected_trailing[i])))

result = [(m, method, actual, expected, totals_match(actual, expected), params["run_id"]) for m, method, actual, expected in checks]
spark.createDataFrame(
    result, "order_month STRING, method STRING, actual STRING, expected STRING, matches BOOLEAN, run_id STRING"
).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.aibi_viz_running_total_check")
display(spark.table(f"{fq}.aibi_viz_running_total_check").orderBy("method", "order_month"))

final = expected_running[-1] if expected_running else 0
print(f"{len(months)} months; final running total {final}")
failed = [r for r in result if not r[4]]
if failed:
    raise Exception(f"{len(failed)} running total checks differ: {failed[:3]}")
