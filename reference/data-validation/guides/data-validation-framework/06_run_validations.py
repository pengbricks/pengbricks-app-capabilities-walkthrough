# Databricks notebook source
# MAGIC %md
# MAGIC # 6. Run the validations
# MAGIC
# MAGIC Safe to rerun: it stops with a message, before any change, if the landed tables, the silver table or this run's source snapshot are missing. The results for a `run_id` are replaced, and each job run adds its own rows to `dv_check_results`, a history table. Reads the `checks` list from the use-case spec and runs every check the same way: build one SQL statement for the check type, measure one number, compare it with the threshold, and record the result. Reconciliation checks ask the source for aggregates through `remote_query` (or read the snapshot from the previous task) and compare them with the same aggregates on the Databricks copy.
# MAGIC
# MAGIC One row per check goes to `dv_check_results`. A view, `dv_latest_failures`, shows the failures of the latest run, which is what the SQL alert reads. The notebook then fails the task when a check at or above the `block_on` level did not pass, which stops `publish_metric_view`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_data_validation", ['catalog', 'schema', 'use_case', 'block_on', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
run_id, block_on = params["run_id"], params["block_on"]
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Load and check the spec
# MAGIC
# MAGIC A typo in the spec fails here, before any check runs.

# COMMAND ----------

from decimal import Decimal
import dv_lib

spec = dv_lib.load_spec(SPEC_FILE)
problems = dv_lib.validate_spec(spec)
if problems:
    raise ValueError("The checks list has problems:\n" + "\n".join(problems))
print(f"{len(spec['checks'])} checks in the spec")
dv_lib.require_ready(spark, ns, "run_validations", run_id, spec)
# COMMAND ----------

# MAGIC %md
# MAGIC ## Run every check

# COMMAND ----------

cfg = spec["source"]

def snapshot(check_name: str):
    rows = spark.sql(
        f"SELECT slice, metric, value FROM {ns}.dv_source_snapshot WHERE run_id = '{run_id}' AND check_name = '{check_name}'"
    ).collect()
    out = {}
    for r in rows:
        out.setdefault(r.slice, {})[r.metric] = Decimal(r.value)
    if not out:
        raise LookupError(f"no snapshot rows for {check_name} in run {run_id}")
    return out

ctx = dv_lib.Context(
    spark=spark,
    ns=ns,
    source_schema=dv_lib.ident(cfg["schema"]),
    checksum_columns=dv_lib.columns_from_spec(spec["checksum_columns"]["orders"]),
    remote=lambda sql: dv_lib.remote_query(spark, cfg["connection_name"], cfg["lakebase_database"], sql),
    snapshot=snapshot,
)
results = []
for check in spec["checks"]:
    result = dv_lib.run_check(check, ctx)
    results.append(result)
    print(f"{result.status.upper():5} {result.severity:5} {result.check_name}: {result.details[:220]}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the results
# MAGIC
# MAGIC A rerun with the same `run_id` replaces its own rows. Results of other runs stay, so the table is the history.

# COMMAND ----------

from datetime import datetime, timezone

ddl = ("run_id STRING, checked_at TIMESTAMP, check_name STRING, check_type STRING, dataset STRING, severity STRING, "
       "observed DOUBLE, operator STRING, expected DOUBLE, status STRING, details STRING")
checked_at = datetime.now(timezone.utc)
rows = [(run_id, checked_at, r.check_name, r.check_type, r.dataset, r.severity, r.observed, r.operator, r.expected, r.status, r.details) for r in results]
spark.sql(f"CREATE TABLE IF NOT EXISTS {ns}.dv_check_results ({ddl})")
spark.sql(f"DELETE FROM {ns}.dv_check_results WHERE run_id = '{run_id}'")
spark.createDataFrame(rows, ddl).write.mode("append").saveAsTable(f"{ns}.dv_check_results")
spark.sql(f"""
    CREATE OR REPLACE VIEW {ns}.dv_latest_failures AS
    SELECT * FROM {ns}.dv_check_results
    WHERE status <> 'pass' AND run_id = (SELECT run_id FROM {ns}.dv_check_results ORDER BY checked_at DESC LIMIT 1)
""")
display(spark.table(f"{ns}.dv_check_results").where(f"run_id = '{run_id}'").select("check_name", "check_type", "severity", "observed", "operator", "expected", "status"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Stop the job when a blocking check failed
# MAGIC
# MAGIC `block_on = error` stops on a failed or broken error-severity check. `warn` stops on any failure. `none` never stops.

# COMMAND ----------

passed = sum(r.status == "pass" for r in results)
print(f"{passed} of {len(results)} checks passed")
stop = dv_lib.blocking(results, block_on)
if stop:
    raise SystemExit(f"Blocked by {len(stop)} check(s) at block_on={block_on}: " + ", ".join(r.check_name for r in stop))
print(f"Nothing blocks the next task at block_on={block_on}")
