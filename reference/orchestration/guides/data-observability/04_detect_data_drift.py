# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Detect data drift
# MAGIC
# MAGIC Detects a distribution shift between a baseline batch and a later batch.
# MAGIC
# MAGIC 1. Write the baseline batch and create a Unity Catalog data profiling monitor. Creating the monitor starts a refresh, and the notebook requests one more, so the first two windows both see the baseline (drift 0).
# MAGIC 2. Append the shifted batch and refresh again. The monitor compares this window with the previous one.
# MAGIC 3. Compute PSI and mean shift here as an independent check, and record every result.
# MAGIC
# MAGIC The monitor step is best effort: if it cannot be created, the in-notebook statistics still run. The batch table is overwritten and the monitor is recreated on each run, so a rerun does not stack batches or monitors.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_observability", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]
prefix = f"{catalog}.{schema}"
TABLE = "obs_orders_batches"
full = f"{prefix}.{TABLE}"
assets_dir = str(bundle_root() / "monitor_assets")

import time
from datetime import datetime, timezone
import guide_lib as g
from databricks.sdk import WorkspaceClient
from pyspark.sql import functions as F

w = WorkspaceClient()
spec = g.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
obs = spec["observability"]
base_cfg, shifted_cfg = obs["batches"][0], obs["batches"][1]
now = datetime.now(timezone.utc)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Monitor helpers

# COMMAND ----------

def wait_for_refreshes(w, object_id: str, successes: int, timeout_s: int = 1500) -> str:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        refreshes = list(w.data_quality.list_refresh(object_type="table", object_id=object_id))
        states = [r.state.value.replace("MONITOR_REFRESH_STATE_", "") if r.state else "UNKNOWN" for r in refreshes]
        if "FAILED" in states:
            failed = next(r for r in refreshes if r.state and r.state.value.endswith("FAILED"))
            return f"FAILED: {failed.message}"
        if states.count("SUCCESS") >= successes and not {"PENDING", "RUNNING"} & set(states):
            return "SUCCESS"
        time.sleep(20)
    return "TIMEOUT"


def run_monitor_baseline(w, spark, catalog, schema, assets_dir):
    from databricks.sdk.service.dataquality import DataProfilingConfig, Monitor, Refresh, SnapshotConfig

    table = w.tables.get(f"{catalog}.{schema}.{TABLE}")
    schema_info = w.schemas.get(f"{catalog}.{schema}")
    try:
        w.data_quality.delete_monitor(object_type="table", object_id=table.table_id)
        time.sleep(15)
    except Exception:  # noqa: BLE001 - no monitor yet
        pass
    w.workspace.mkdirs(assets_dir)
    monitor = w.data_quality.create_monitor(
        monitor=Monitor(
            object_type="table",
            object_id=table.table_id,
            data_profiling_config=DataProfilingConfig(
                assets_dir=assets_dir, output_schema_id=schema_info.schema_id, snapshot=SnapshotConfig()
            ),
        )
    )
    time.sleep(10)
    w.data_quality.create_refresh(
        object_type="table", object_id=table.table_id, refresh=Refresh(object_type="table", object_id=table.table_id)
    )
    return table.table_id, monitor

# COMMAND ----------

# MAGIC %md
# MAGIC ## Baseline batch and monitor

# COMMAND ----------

def batch(cfg):
    df = g.build_orders(spark, spec, rows=int(cfg["rows"]), seed_offset=int(cfg["seed_offset"]), overrides=cfg.get("overrides"))
    return df.select(F.lit(cfg["name"]).alias("batch_id"), "order_id", "order_ts", "region", "quantity", "amount")

batch(base_cfg).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(full)

monitor_status, object_id, drift_table, profile_table = "skipped", None, None, None
try:
    object_id, _ = run_monitor_baseline(w, spark, catalog, schema, assets_dir)
    monitor_status = "baseline refresh " + wait_for_refreshes(w, object_id, successes=1)
except Exception as error:  # noqa: BLE001
    monitor_status = f"monitor not created: {str(error)[:300]}"
    object_id = None
print("monitor:", monitor_status)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Append the shifted batch

# COMMAND ----------

batch(shifted_cfg).write.mode("append").saveAsTable(full)

# COMMAND ----------

# MAGIC %md
# MAGIC ## PSI and mean shift computed here
# MAGIC
# MAGIC PSI on `amount` uses bins from the baseline quantiles. PSI on `region` compares the region mix.

# COMMAND ----------

base_amounts = sorted(r.amount for r in spark.table(full).where(f"batch_id = '{base_cfg['name']}'").select("amount").collect())
new_amounts = [r.amount for r in spark.table(full).where(f"batch_id = '{shifted_cfg['name']}'").select("amount").collect()]
edges = g.quantile_edges(base_amounts, 10)
amount_psi = g.psi(g.histogram(base_amounts, edges), g.histogram(new_amounts, edges))
regions = [r.region for r in spark.table(full).select("region").distinct().orderBy("region").collect()]

def region_counts(name):
    counts = {r.region: r["count"] for r in spark.table(full).where(f"batch_id = '{name}'").groupBy("region").count().collect()}
    return [counts.get(region, 0) for region in regions]

region_psi = g.psi(region_counts(base_cfg["name"]), region_counts(shifted_cfg["name"]))
base_mean = sum(base_amounts) / len(base_amounts)
new_mean = sum(new_amounts) / len(new_amounts)
shift = g.mean_shift_pct(base_mean, new_mean)
psi_limit, shift_limit = float(obs["psi_threshold"]), float(obs["mean_shift_threshold_pct"])

results = [
    (run_id, "job_psi", "amount", "psi", None, None, amount_psi, psi_limit, amount_psi >= psi_limit, g.psi_label(amount_psi, psi_limit), now),
    (run_id, "job_psi", "region", "psi", None, None, region_psi, psi_limit, region_psi >= psi_limit, g.psi_label(region_psi, psi_limit), now),
    (run_id, "job_mean_shift", "amount", "mean_shift_pct", base_mean, new_mean, shift, shift_limit, abs(shift) >= shift_limit, "mean shift", now),
]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Second monitor refresh and its drift metrics

# COMMAND ----------

if object_id and monitor_status == "baseline refresh SUCCESS":
    try:
        from databricks.sdk.service.dataquality import Refresh

        w.data_quality.create_refresh(object_type="table", object_id=object_id, refresh=Refresh(object_type="table", object_id=object_id))
        time.sleep(10)
        second = wait_for_refreshes(w, object_id, successes=2)
        config = w.data_quality.get_monitor(object_type="table", object_id=object_id).data_profiling_config
        drift_table, profile_table = config.drift_metrics_table_name, config.profile_metrics_table_name
        monitor_status = f"two refreshes: {second}"
        if second == "SUCCESS" and drift_table:
            drift = spark.sql(
                f"""
                SELECT column_name, MAX(js_distance) AS js_distance, MAX(wasserstein_distance) AS wasserstein_distance,
                       MAX(ks_test) AS ks_test_stat, MAX(avg_delta) AS avg_delta, MAX(chi_squared_test.statistic) AS chi_sq
                FROM {drift_table}
                WHERE column_name IN ('amount', 'region', 'quantity') AND drift_type = 'CONSECUTIVE'
                GROUP BY column_name
                """
            ).collect()
            for row in drift:
                metric, value = (
                    ("wasserstein_distance", row.wasserstein_distance) if row.wasserstein_distance is not None
                    else ("js_distance", row.js_distance)
                )
                results.append((run_id, "uc_monitor", row.column_name, metric, None, None,
                                float(value) if value is not None else None, None, None, "see drift metrics table", now))
    except Exception as error:  # noqa: BLE001
        monitor_status = f"second refresh failed: {str(error)[:300]}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results

# COMMAND ----------

result_ddl = (
    "job_run_id STRING, method STRING, column_name STRING, metric STRING, baseline_value DOUBLE, current_value DOUBLE, "
    "metric_value DOUBLE, threshold DOUBLE, flagged BOOLEAN, reading STRING, evaluated_at TIMESTAMP"
)
status_ddl = (
    "job_run_id STRING, monitored_table STRING, monitor_object_id STRING, status STRING, profile_metrics_table STRING, "
    "drift_metrics_table STRING, recorded_at TIMESTAMP"
)
for name, ddl, data in (
    ("obs_drift_results", result_ddl, results),
    ("obs_monitor_status", status_ddl, [(run_id, full, object_id, monitor_status, profile_table, drift_table, now)]),
):
    spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.{name} ({ddl})")
    spark.sql(f"DELETE FROM {prefix}.{name} WHERE job_run_id = '{run_id}'")
    spark.createDataFrame(data, ddl).write.mode("append").saveAsTable(f"{prefix}.{name}")

print(f"amount PSI {amount_psi:.3f}  region PSI {region_psi:.3f}  amount mean {base_mean:.1f} -> {new_mean:.1f} ({shift:+.1f}%)")
print("monitor:", monitor_status, "| drift table:", drift_table)
if not (amount_psi >= psi_limit and abs(shift) >= shift_limit):
    raise RuntimeError("the shifted batch was not flagged as drift")
