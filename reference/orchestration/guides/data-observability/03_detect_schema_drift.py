# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Detect schema drift
# MAGIC
# MAGIC Changes the silver table's schema, then detects the change two ways: by comparing `information_schema` snapshots from before and after, and by reading `DESCRIBE HISTORY`. It replaces any rows already recorded for the same `run_id`. Run `01_build_chain` first, which also resets the silver table, so every run starts from the same schema.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_observability", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]
prefix = f"{catalog}.{schema}"
TABLE = "obs_silver_orders"
full = f"{prefix}.{TABLE}"

from datetime import datetime, timezone
import guide_lib as g
changes = g.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))["observability"]["schema_changes"]
add, widen = changes["add_column"], changes["widen_column"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Snapshot helpers

# COMMAND ----------

def snapshot(spark, catalog: str, schema: str, table: str) -> dict[str, tuple[str, int]]:
    rows = spark.sql(
        f"""
        SELECT column_name, data_type, ordinal_position
        FROM {catalog}.information_schema.columns
        WHERE table_schema = '{schema}' AND table_name = '{table}'
        """
    ).collect()
    return {r.column_name: (r.data_type.lower(), int(r.ordinal_position)) for r in rows}


def latest_version(spark, full_name: str) -> int:
    return int(spark.sql(f"DESCRIBE HISTORY {full_name}").agg({"version": "max"}).first()[0])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Change the schema: a new column and a widened type

# COMMAND ----------

before = snapshot(spark, catalog, schema, TABLE)
if add["name"] in before:
    raise RuntimeError(f"{TABLE} already has {add['name']}. Run 01_build_chain to reset the chain, then run this notebook again.")
version_before = latest_version(spark, full)

spark.sql(f"ALTER TABLE {full} ADD COLUMNS ({add['name']} {add['type']})")
spark.sql(f"ALTER TABLE {full} SET TBLPROPERTIES ('delta.enableTypeWidening' = 'true')")
spark.sql(f"ALTER TABLE {full} ALTER COLUMN {widen['name']} TYPE {widen['to_type']}")

after = snapshot(spark, catalog, schema, TABLE)
now = datetime.now(timezone.utc)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Detect and record the drift

# COMMAND ----------

snap_ddl = (
    "job_run_id STRING, snapshot STRING, captured_at TIMESTAMP, table_name STRING, column_name STRING, "
    "data_type STRING, ordinal_position INT, delta_version BIGINT"
)
snap_rows = [
    (run_id, label, now, TABLE, name, dtype, pos, version)
    for label, snap, version in (("before", before, version_before), ("after", after, latest_version(spark, full)))
    for name, (dtype, pos) in snap.items()
]

history = [
    r.asDict() for r in spark.sql(f"DESCRIBE HISTORY {full}").select("version", "timestamp", "operation", "operationParameters").collect()
]
relevant = g.schema_changing_history(history, after_version=version_before)

events = []
for event in g.diff_schemas({k: v[0] for k, v in before.items()}, {k: v[0] for k, v in after.items()}):
    match = next((h for h in relevant if event["column_name"] in str(h["operationParameters"])), None)
    events.append(
        (
            run_id, TABLE, event["change_type"], event["column_name"], event["old_type"], event["new_type"],
            match["version"] if match else None, match["operation"] if match else None, now,
        )
    )

event_ddl = (
    "job_run_id STRING, table_name STRING, change_type STRING, column_name STRING, old_type STRING, new_type STRING, "
    "history_version BIGINT, history_operation STRING, detected_at TIMESTAMP"
)
history_ddl = "job_run_id STRING, version BIGINT, timestamp TIMESTAMP, operation STRING, operation_parameters STRING"
history_rows = [(run_id, int(h["version"]), h["timestamp"], h["operation"], str(h["operationParameters"])) for h in relevant]
for name, ddl, data in (
    ("obs_schema_snapshots", snap_ddl, snap_rows),
    ("obs_schema_drift_events", event_ddl, events),
    ("obs_schema_history", history_ddl, history_rows),
):
    spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.{name} ({ddl})")
    spark.sql(f"DELETE FROM {prefix}.{name} WHERE job_run_id = '{run_id}'")
    spark.createDataFrame(data, ddl).write.mode("append").saveAsTable(f"{prefix}.{name}")

print(f"schema drift on {TABLE}: {len(events)} event(s)")
for e in events:
    print(f"  {e[2]:14} {e[3]:14} {e[4]} -> {e[5]}  (history version {e[6]}, {e[7]})")
if len(events) < 2:
    raise RuntimeError("expected an added column and a type change to be detected")
