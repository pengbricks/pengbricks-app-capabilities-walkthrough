# Databricks notebook source
# MAGIC %md
# MAGIC # 5. Read expectation metrics
# MAGIC
# MAGIC Safe to rerun: `dv_expectation_metrics_latest` is overwritten, and the rows for a `run_id` are replaced in `dv_expectation_metrics`, a history table that gains one set per job run. The pipeline task has already run. This notebook reads the pass and fail count of every expectation from the pipeline event log (`event_log(<pipeline id>)`) for the latest update and stores them in `dv_expectation_metrics`. Rows dropped by a drop rule appear as `failed_records`, and the same rows are in the quarantine table.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from databricks.sdk import WorkspaceClient
import dv_lib
# In the job, the pipeline id arrives as a parameter. Run by hand, look the pipeline up by name.
params = load_params(dbutils, "capability_guides_data_validation", ['catalog', 'schema', 'pipeline_id', 'run_id'],
                     defaults={'run_id': 'manual', 'pipeline_id': dv_lib.find_pipeline_id(WorkspaceClient(), "capability-guides-data-validation")})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
run_id = params["run_id"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Expectations in the latest update

# COMMAND ----------

pipeline_id = params["pipeline_id"]
metrics = spark.sql(f"""
    SELECT '{run_id}' AS run_id, timestamp AS logged_at, origin.flow_name AS flow, exp.dataset, exp.name AS expectation,
           exp.passed_records, exp.failed_records
    FROM event_log('{pipeline_id}')
    LATERAL VIEW explode(from_json(details:flow_progress.data_quality.expectations,
                  'array<struct<name:string,dataset:string,passed_records:bigint,failed_records:bigint>>')) t AS exp
    WHERE event_type = 'flow_progress'
      AND origin.update_id = (SELECT origin.update_id FROM event_log('{pipeline_id}') WHERE event_type = 'create_update' ORDER BY timestamp DESC LIMIT 1)
""")
metrics.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{ns}.dv_expectation_metrics_latest")
display(spark.table(f"{ns}.dv_expectation_metrics_latest").orderBy("dataset", "expectation"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Keep a history by run
# MAGIC
# MAGIC `dv_expectation_metrics` keeps one set of rows per `run_id`. A rerun with the same `run_id` replaces its own rows.

# COMMAND ----------

spark.sql(f"CREATE TABLE IF NOT EXISTS {ns}.dv_expectation_metrics AS SELECT * FROM {ns}.dv_expectation_metrics_latest WHERE 1 = 0")
spark.sql(f"DELETE FROM {ns}.dv_expectation_metrics WHERE run_id = '{run_id}'")
spark.sql(f"INSERT INTO {ns}.dv_expectation_metrics SELECT * FROM {ns}.dv_expectation_metrics_latest")
rows = spark.table(f"{ns}.dv_expectation_metrics_latest").collect()
if not rows:
    raise RuntimeError("the event log returned no expectation metrics for the latest update")
for r in sorted(rows, key=lambda r: (r.dataset, r.expectation)):
    print(f"{r.dataset}.{r.expectation}: passed {r.passed_records}, failed {r.failed_records}")
