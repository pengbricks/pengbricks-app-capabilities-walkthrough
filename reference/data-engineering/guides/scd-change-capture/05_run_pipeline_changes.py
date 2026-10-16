# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Run the pipeline on the change batch
# MAGIC
# MAGIC Starts an incremental update, so the pipeline applies only the new `change_seq` 2 rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_scd", ['catalog', 'schema', 'use_case', 'run_pipeline'], defaults={'run_pipeline': 'true'})
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"
ROOT = bundle_root()
USE_CASE_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start an update and wait
# MAGIC
# MAGIC Run by hand, this notebook is how you run the pipeline. In the job, the pipeline task has already run, so `run_pipeline` is `false` and this notebook only inspects.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from de_common.pipelines import find_pipeline_id, latest_expectations, run_update

w = WorkspaceClient()
pipeline_id = find_pipeline_id(w, "capability-guides-scd")
print(f"pipeline {pipeline_id}: {w.config.host.rstrip('/')}/pipelines/{pipeline_id}")
if params["run_pipeline"].lower() == "true":
    run_update(w, pipeline_id, full_refresh=False)
else:
    print("run_pipeline = false: the job's pipeline task already ran, so this notebook only inspects.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Output tables
# MAGIC
# MAGIC Row counts of the type 1 and type 2 streaming tables after the changes.

# COMMAND ----------

for table in ['accounts_scd1', 'accounts_scd2']:
    print(f"{table}: {spark.table(f'{scope}.{table}').count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Expectation results
# MAGIC
# MAGIC Per-expectation pass and fail counts from the pipeline event log. Empty when the pipeline defines no expectations.

# COMMAND ----------

try:
    display(latest_expectations(spark, pipeline_id).limit(50))
except Exception as exc:  # the event log is not readable in every workspace
    print(f"Event log not available: {exc}")
