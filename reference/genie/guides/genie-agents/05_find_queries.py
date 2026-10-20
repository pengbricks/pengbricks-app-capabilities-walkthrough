# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Find the agent's queries in system tables
# MAGIC
# MAGIC Searches `system.query.history` for statements whose `query_source.genie_space_id` is this agent, from the moment task 3 started asking. It records who ran each statement (`executed_by`, `executed_as`), the compute (`compute.type`, `compute.warehouse_id`), and the client application. System tables lag the real queries by minutes, so the notebook polls for up to 20 minutes and reports what it found. If rows have not arrived, it records that and does not fail the job.
# MAGIC
# MAGIC It then checks `system.billing.usage` for Genie usage (`billing_origin_product = 'GENIE'`) and for the warehouse's SQL usage. Billing rows can take hours, so an empty result on the first run is normal.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_genie_agents", ['catalog', 'schema', 'warehouse_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id, warehouse_id = params["catalog"], params["schema"], params["run_id"], params["warehouse_id"]
base = f"{catalog}.{schema}"

import json
from databricks.sdk import WorkspaceClient
from agent_results import GUIDE, history_sql, read_step, result_row, summarize_history, wait_for_rows, write_step

w = WorkspaceClient()
space_id = spark.sql(f"SELECT space_id FROM {base}.genie_spaces WHERE guide = '{GUIDE}' AND role = 'agent'").first()["space_id"]
ask_rows = read_step(spark, base, "ask")
since = next(row["value"] for row in ask_rows if row["item"] == "window_start")
with_sql = sum(1 for row in ask_rows if row["detail"].startswith("{") and json.loads(row["detail"]).get("has_sql"))
print(f"agent {space_id}, searching from {since}, expecting at least {with_sql} statements")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Query history

# COMMAND ----------

def fetch():
    return [row.asDict() for row in spark.sql(history_sql(space_id, since)).collect()]

found, polls = wait_for_rows(fetch, minimum=with_sql, attempts=40, pause_seconds=30)
rows = [result_row(run_id, "query_history", "statements_found", len(found), f"expected at least {with_sql}; polled {polls} time(s), 30 s apart")]
if found:
    summary = summarize_history(found)
    for key, value in summary.items():
        rows.append(result_row(run_id, "query_history", key, value, "distinct values across the statements"))
    for row in found:
        rows.append(result_row(run_id, "query_history", row["statement_id"], row["execution_status"], json.dumps({k: row[k] for k in ("executed_by", "executed_as", "warehouse_id", "client_application", "total_duration_ms")}, default=str)))
    rows.append(result_row(run_id, "query_history", "warehouse_matches_agent", summary["warehouse_id"] == warehouse_id, f"agent warehouse {warehouse_id}"))
    print(summary)
else:
    rows.append(result_row(run_id, "query_history", "note", "rows had not arrived", "system.query.history lagged the polling window; rerun task 5 later"))
    print("No rows yet in system.query.history")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Billing

# COMMAND ----------

def attempt(label, sql):
    try:
        data = [row.asDict() for row in spark.sql(sql).collect()]
        return result_row(run_id, "billing", label, len(data), json.dumps(data, default=str)[:1500])
    except Exception as error:
        return result_row(run_id, "billing", label, "query failed", str(error)[:300])

rows.append(attempt("genie_usage_last_2_days", """
    SELECT usage_date, sku_name, usage_metadata.genie.surface AS surface, SUM(usage_quantity) AS dbus
    FROM system.billing.usage
    WHERE billing_origin_product = 'GENIE' AND usage_date >= date_sub(current_date(), 2)
    GROUP BY ALL ORDER BY usage_date"""))
rows.append(attempt("warehouse_sql_usage_last_2_days", f"""
    SELECT usage_date, sku_name, SUM(usage_quantity) AS dbus
    FROM system.billing.usage
    WHERE billing_origin_product = 'SQL' AND usage_metadata.warehouse_id = '{warehouse_id}' AND usage_date >= date_sub(current_date(), 2)
    GROUP BY ALL ORDER BY usage_date"""))
write_step(spark, base, "query_history", [row for row in rows if row[1] == "query_history"])
write_step(spark, base, "billing", [row for row in rows if row[1] == "billing"])
for row in rows:
    if row[1] == "billing":
        print(row[2], row[3], row[4][:200])
