# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Read the lineage
# MAGIC
# MAGIC Reads the chain back from `system.access.table_lineage` and `column_lineage`. Lineage lands in system tables a few minutes after the writes, so the notebook polls. It replaces any rows already recorded for the same `run_id`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_observability", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
prefix = f"{params['catalog']}.{params['schema']}"
run_id = params["run_id"]

import time
CHAIN = ["obs_source_orders", "obs_silver_orders", "obs_gold_daily_revenue"]
MAX_WAIT_MINUTES = 25
names = [f"{prefix}.{t}".lower() for t in CHAIN]
in_list = ", ".join(f"'{n}'" for n in names[1:])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Poll for table lineage

# COMMAND ----------

table_sql = f"""
    SELECT lower(source_table_full_name) AS source_table, lower(target_table_full_name) AS target_table,
           MAX(event_time) AS last_seen, MAX(entity_type) AS written_by
    FROM system.access.table_lineage
    WHERE lower(target_table_full_name) IN ({in_list}) AND source_table_full_name IS NOT NULL
      AND event_date >= current_date() - 1
    GROUP BY 1, 2
"""
deadline = time.time() + MAX_WAIT_MINUTES * 60
while True:
    edges = [r.asDict() for r in spark.sql(table_sql).collect()]
    found = {(e["source_table"], e["target_table"]) for e in edges}
    if (names[0], names[1]) in found and (names[1], names[2]) in found:
        break
    if time.time() > deadline:
        raise RuntimeError(f"lineage for {names} not visible in system.access.table_lineage after {MAX_WAIT_MINUTES} min")
    print("lineage not visible yet; waiting 30 s")
    time.sleep(30)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Walk upstream from gold
# MAGIC
# MAGIC Depth 1 is silver, depth 2 is the source.

# COMMAND ----------

upstream = {e["target_table"]: e["source_table"] for e in edges}
rows, current, depth = [], names[2], 0
while current in upstream:
    depth += 1
    edge = next(e for e in edges if e["target_table"] == current)
    rows.append((run_id, depth, edge["source_table"], current, edge["last_seen"], edge["written_by"]))
    current = upstream[current]

edge_ddl = "job_run_id STRING, hops_upstream_of_gold INT, source_table STRING, target_table STRING, last_seen TIMESTAMP, written_by STRING"
spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.obs_lineage_edges ({edge_ddl})")
spark.sql(f"DELETE FROM {prefix}.obs_lineage_edges WHERE job_run_id = '{run_id}'")
spark.createDataFrame(rows, edge_ddl).write.mode("append").saveAsTable(f"{prefix}.obs_lineage_edges")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Column lineage

# COMMAND ----------

column_sql = f"""
    SELECT lower(source_table_full_name) AS source_table, source_column_name,
           lower(target_table_full_name) AS target_table, target_column_name, MAX(event_time) AS last_seen
    FROM system.access.column_lineage
    WHERE lower(target_table_full_name) IN ({in_list}) AND source_table_full_name IS NOT NULL
      AND event_date >= current_date() - 1
    GROUP BY 1, 2, 3, 4
"""
columns = [r.asDict() for r in spark.sql(column_sql).collect()]
col_rows = [(run_id, c["source_table"], c["source_column_name"], c["target_table"], c["target_column_name"], c["last_seen"]) for c in columns]
col_ddl = "job_run_id STRING, source_table STRING, source_column STRING, target_table STRING, target_column STRING, last_seen TIMESTAMP"
spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.obs_column_lineage ({col_ddl})")
spark.sql(f"DELETE FROM {prefix}.obs_column_lineage WHERE job_run_id = '{run_id}'")
spark.createDataFrame(col_rows, col_ddl).write.mode("append").saveAsTable(f"{prefix}.obs_column_lineage")

print(f"table lineage: {len(rows)} hops walked upstream from {names[2]}")
for r in rows:
    print(f"  {r[2]} -> {r[3]}")
print(f"column lineage: {len(col_rows)} column edges")
