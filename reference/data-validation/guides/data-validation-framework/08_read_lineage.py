# Databricks notebook source
# MAGIC %md
# MAGIC # 8. Read lineage for impact analysis
# MAGIC
# MAGIC Safe to rerun: it stops with a message if the silver table or this run's check results are missing. The impact rows for a `run_id` are replaced, and each job run adds its own rows to `dv_lineage_impact`, a history table. For every dataset the checks cover, lists what it feeds, using `system.access.table_lineage`: downstream tables and views (up to three hops), and the other entities that read the table, such as notebooks and dashboards. When a check fails, that list is the blast radius. The notebook also lists the upstream tables of the silver table.
# MAGIC
# MAGIC Lineage reaches the system tables several minutes after the writes, so the notebook polls. The job runs this task even when validation blocked the metric view (`run_if: ALL_DONE`), because impact analysis matters most after a failure.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_data_validation", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
run_id = params["run_id"]
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Poll until the pipeline's edge is visible

# COMMAND ----------

import time
import dv_lib
dv_lib.require_ready(spark, ns, "read_lineage", run_id)
spec = dv_lib.load_spec(SPEC_FILE)
MAX_WAIT_MINUTES = 30
low = lambda table: f"{ns}.{table}".lower()
landed, silver, view = low("dv_orders_landed"), low("dv_orders_silver"), low(spec["metric_view"]["name"])

def edges_from(sources: list[str]) -> list[dict]:
    in_list = ", ".join(f"'{s}'" for s in sources)
    return [r.asDict() for r in spark.sql(f"""
        SELECT lower(source_table_full_name) AS source_table, lower(target_table_full_name) AS target_table,
               entity_type, MAX(event_time) AS last_seen
        FROM system.access.table_lineage
        WHERE lower(source_table_full_name) IN ({in_list}) AND event_date >= current_date() - 2
        GROUP BY 1, 2, 3
    """).collect()]

view_published = spark.catalog.tableExists(view)  # the publish task is skipped when validation blocks it
deadline = time.time() + MAX_WAIT_MINUTES * 60
first_edge_at = None
while True:
    pipeline_edge = any(e["target_table"] == silver for e in edges_from([landed]))
    view_edge = view_published and any(e["target_table"] == view for e in edges_from([silver]))
    if pipeline_edge and first_edge_at is None:
        first_edge_at = time.time()
    # After the pipeline edge shows up, wait at most 10 more minutes for the metric view edge.
    if pipeline_edge and (view_edge or not view_published or time.time() > first_edge_at + 10 * 60):
        break
    if time.time() > deadline:
        raise RuntimeError(f"no lineage from {landed} to {silver} in system.access.table_lineage after {MAX_WAIT_MINUTES} min")
    print(f"pipeline edge visible: {pipeline_edge}; metric view edge visible: {view_edge}; waiting 30 s")
    time.sleep(30)
print(f"pipeline edge visible: {pipeline_edge}; metric view edge visible: {view_edge}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Walk downstream from each dataset

# COMMAND ----------

failed = {r.dataset for r in spark.sql(f"SELECT dataset FROM {ns}.dv_check_results WHERE run_id = '{run_id}' AND status <> 'pass'").collect()}
datasets = sorted(r.dataset for r in spark.sql(f"SELECT DISTINCT dataset FROM {ns}.dv_check_results WHERE run_id = '{run_id}'").collect())

rows, readers = [], {}
for dataset in datasets:
    start = low(dataset)
    frontier, seen = [start], {start}
    for hop in range(1, 4):
        if not frontier:
            break
        nxt = []
        for e in edges_from(frontier):
            if e["target_table"] and e["target_table"] not in seen:
                seen.add(e["target_table"])
                nxt.append(e["target_table"])
                rows.append((run_id, dataset, dataset in failed, "downstream", hop, e["target_table"], e["entity_type"], e["last_seen"]))
            elif not e["target_table"]:  # a read with no table written: a dashboard, notebook, or query
                key = (dataset, e["entity_type"])
                if key not in readers:  # keep the nearest hop for each kind of reader
                    readers[key] = (run_id, dataset, dataset in failed, "reader", hop, None, e["entity_type"], e["last_seen"])
        frontier = nxt
rows += readers.values()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Upstream of the silver table

# COMMAND ----------

upstream = [(run_id, "dv_orders_silver", "dv_orders_silver" in failed, "upstream", 1, e["source_table"], e["entity_type"], e["last_seen"])
            for e in [r.asDict() for r in spark.sql(f"""
                SELECT lower(source_table_full_name) AS source_table, entity_type, MAX(event_time) AS last_seen
                FROM system.access.table_lineage
                WHERE lower(target_table_full_name) = '{silver}' AND source_table_full_name IS NOT NULL AND event_date >= current_date() - 2
                GROUP BY 1, 2""").collect()]]
rows += upstream

# COMMAND ----------

# MAGIC %md
# MAGIC ## Store the impact list

# COMMAND ----------

ddl = ("run_id STRING, dataset STRING, dataset_has_failed_check BOOLEAN, direction STRING, hops INT, "
       "related_table STRING, entity_type STRING, last_seen TIMESTAMP")
spark.sql(f"CREATE TABLE IF NOT EXISTS {ns}.dv_lineage_impact ({ddl})")
spark.sql(f"DELETE FROM {ns}.dv_lineage_impact WHERE run_id = '{run_id}'")
spark.createDataFrame(rows, ddl).write.mode("append").saveAsTable(f"{ns}.dv_lineage_impact")
display(spark.table(f"{ns}.dv_lineage_impact").where(f"run_id = '{run_id}'").orderBy("dataset", "direction", "hops"))
for r in rows:
    print(f"{r[1]:24} {r[3]:10} hop {r[4]}  {r[5]}  ({r[6]})")
print(f"datasets with a failed check this run: {sorted(failed) or 'none'}")
