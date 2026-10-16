# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. MERGE into the target
# MAGIC
# MAGIC One MERGE inserts, updates and deletes. The operation metrics come from Delta history and go to `target_merge_metrics`, a run log that gains one run's rows per run. Run `01_prepare_target` first, which resets the target.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_target_loading", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"
ROOT = bundle_root()
USE_CASE_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run the MERGE

# COMMAND ----------

from delta.tables import DeltaTable
from de_common.accounts import entity_columns
from de_common.files import merge_metrics
from de_common.spec import load_use_case

spec = load_use_case(USE_CASE_FILE)
key = spec["accounts"]["key"]
columns = entity_columns(spec)
target_name, source_name = f"{scope}.accounts_target", f"{scope}.accounts_source_batch"

before = spark.table(target_name).count()
source = spark.table(source_name)
target = DeltaTable.forName(spark, target_name)
assignments = {name: f"s.{name}" for name in columns}
(
    target.alias("t")
    .merge(source.alias("s"), f"t.{key} = s.{key}")
    .whenMatchedDelete(condition="s.change_type = 'DELETE'")
    .whenMatchedUpdate(condition="s.change_type = 'UPDATE'", set=assignments)
    .whenNotMatchedInsert(condition="s.change_type = 'INSERT'", values=assignments)
    .execute()
)
after = spark.table(target_name).count()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the metrics from Delta history

# COMMAND ----------

from datetime import datetime, timezone
from pyspark.sql import functions as F

history = (
    target.history().where("operation = 'MERGE'").orderBy(F.col("version").desc())
    .select("version", "operation", "operationMetrics").first()
)
metrics = merge_metrics(dict(history["operationMetrics"]))
changes = spec["accounts"]["changes"]
print(f"MERGE version {history['version']}: rows {before} -> {after}; metrics {metrics}")

run_ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
rows = [(run_ts, int(history["version"]), history["operation"], "rows_before", before), (run_ts, int(history["version"]), history["operation"], "rows_after", after)]
rows += [(run_ts, int(history["version"]), history["operation"], name, value) for name, value in metrics.items()]
spark.createDataFrame(
    rows, "run_ts string, table_version long, operation string, metric string, value long"
).write.mode("append").saveAsTable(f"{scope}.target_merge_metrics")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the metrics against the change batch

# COMMAND ----------

expected = {"inserted": changes["inserts"], "updated": changes["updates"], "deleted": changes["deletes"]}
problems = [f"{k}={metrics[k]} expected {v}" for k, v in expected.items() if metrics[k] != v]
if after != before + changes["inserts"] - changes["deletes"]:
    problems.append(f"rows_after={after}")
if problems:
    raise Exception("MERGE metrics do not match the change batch: " + "; ".join(problems))
print("MERGE metrics match the change batch.")
