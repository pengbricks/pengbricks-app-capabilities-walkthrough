# Databricks notebook source
# MAGIC %md
# MAGIC # 4. Snapshot the source aggregates
# MAGIC
# MAGIC Queries the source once for every reconciliation check marked `source: snapshot` and stores the per-day aggregates in `dv_source_snapshot`. The checks then compare the target with the snapshot, so a re-run of a check does not touch the source again. Use this when the source is busy, when the federated query is slow, or when you want to know what the source held at a given time.
# MAGIC
# MAGIC The aggregates run inside the source through `remote_query`. Only one row per day comes back.

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

from datetime import datetime, timezone
import dv_lib

spec = dv_lib.load_spec(SPEC_FILE)
cfg = spec["source"]
columns = dv_lib.columns_from_spec(spec["checksum_columns"]["orders"])
captured_at = datetime.now(timezone.utc)

rows = []
for check in spec["checks"]:
    if check["type"] != "reconciliation" or check.get("source") != "snapshot":
        continue
    sql = dv_lib.aggregate_sql("postgres", f"{dv_lib.ident(cfg['schema'])}.{dv_lib.ident(check['source_table'])}", check["metrics"], columns, check.get("grain"))
    print(f"{check['name']}: {sql[:160]}...")
    result = dv_lib.remote_query(spark, cfg["connection_name"], cfg["lakebase_database"], sql).collect()
    for slice_key, metrics in dv_lib.to_slices(result, check["metrics"]).items():
        rows += [(run_id, captured_at, check["name"], slice_key, metric, str(value)) for metric, value in metrics.items()]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Store the snapshot
# MAGIC
# MAGIC Long format: one row per check, slice, and metric. A rerun with the same `run_id` replaces its own rows.

# COMMAND ----------

ddl = "run_id STRING, captured_at TIMESTAMP, check_name STRING, slice STRING, metric STRING, value STRING"
spark.sql(f"CREATE TABLE IF NOT EXISTS {ns}.dv_source_snapshot ({ddl})")
spark.sql(f"DELETE FROM {ns}.dv_source_snapshot WHERE run_id = '{run_id}'")
spark.createDataFrame(rows, ddl).write.mode("append").saveAsTable(f"{ns}.dv_source_snapshot")
print(f"Stored {len(rows)} snapshot values for run {run_id}")
