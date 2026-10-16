# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Run the pipeline
# MAGIC
# MAGIC Starts a full refresh of the pipeline and shows what it produced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_sftp", ['catalog', 'schema', 'use_case', 'run_pipeline'], defaults={'run_pipeline': 'true'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start an update and wait
# MAGIC
# MAGIC Run by hand, this notebook is how you run the pipeline. In the job, the pipeline task has already run, so `run_pipeline` is `false` and this notebook only inspects.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from source_ingestion.pipeline_run import find_pipeline_id, latest_expectations, run_update

w = WorkspaceClient()
pipeline_id = find_pipeline_id(w, "capability-guides-sftp")
print(f"pipeline {pipeline_id}: {w.config.host.rstrip('/')}/pipelines/{pipeline_id}")
if params["run_pipeline"].lower() == "true":
    run_update(w, pipeline_id, full_refresh=False)
else:
    print("run_pipeline = false: the job's pipeline task already ran, so this notebook only inspects.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Output tables
# MAGIC
# MAGIC Row counts of the two streaming tables.

# COMMAND ----------

for table in ['sftp_text_files', 'sftp_binary_files']:
    print(f"{table}: {spark.table(f'{ns}.{table}').count()} rows")

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
