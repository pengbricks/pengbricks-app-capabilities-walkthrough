# Databricks notebook source
# MAGIC %md
# MAGIC # 6. Record the counts after the changes
# MAGIC
# MAGIC Safe to rerun: it stops with a message until the pipeline has applied the change batch, and only reads; `scd_run_counts` is a run log, so it is the one table that gains rows.
# MAGIC
# MAGIC After the batch, inserts add current rows, deletes remove them, and type 2 gains a history row for every insert and update. The counts go to `scd_run_counts`, a run log that gains one run's rows per run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_scd", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"
ROOT = bundle_root()
USE_CASE_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Measure both tables
# MAGIC
# MAGIC Type 1 has one row per key. Type 2 keeps history: current rows have a null `__END_AT`. A deleted key is one the feed deleted that has no current row.

# COMMAND ----------

from datetime import datetime, timezone
from de_common.scd import measure, problems
from de_common.spec import load_use_case

from de_common.scd import batch_consumed
if not batch_consumed(spark, scope):
    raise RuntimeError("The pipeline has not applied the change batch yet. Run 04_prepare_changes and 05_run_pipeline_changes first. Nothing was changed.")
values = measure(spark, scope)
run_ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
rows = [(run_ts, "after", metric, int(values["scd1"][metric]), int(values["scd2"][metric])) for metric in values["scd1"]]
for row in rows:
    print(f"{row[1]:<7} {row[2]:<24} scd1={row[3]:<6} scd2={row[4]}")
spark.createDataFrame(
    rows, "run_ts string, phase string, metric string, scd1 long, scd2 long"
).write.mode("append").saveAsTable(f"{scope}.scd_run_counts")
display(spark.table(f"{scope}.scd_run_counts").where("run_ts = '" + run_ts + "'"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the counts against the spec

# COMMAND ----------

spec = load_use_case(USE_CASE_FILE)
found = problems(values, spec, "after")
if found:
    raise Exception("SCD counts do not match the spec: " + "; ".join(found))
print("Counts match the spec.")
