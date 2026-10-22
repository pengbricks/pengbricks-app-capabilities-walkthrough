# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Failures
# MAGIC
# MAGIC Failed, errored and timed-out runs, derived from `ops_job_runs`. Run `02_ops_job_runs` first. Safe to rerun: the table uses `CREATE OR REPLACE`, so a rerun replaces it.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_monitoring_snapshot", ['catalog', 'schema', 'lookback_days', 'audit_lookback_days', 'guide_tag_key', 'use_case_tag_key', 'alert_email'])
catalog, schema = params["catalog"], params["schema"]
fq = f"`{catalog}`.`{schema}`"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Build the table
# MAGIC
# MAGIC The query takes `catalog`, `schema` and the lookback as named parameters.

# COMMAND ----------

SQL = """
-- Failed, errored and timed-out runs, derived from ops_job_runs.
CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.ops_failures') AS
SELECT job_id, run_id, job_name, start_time, end_time, run_date, duration_min,
       result_state, coalesce(termination_code, 'UNKNOWN') AS termination_code,
       trigger_type, run_as, capability_guide_job, capability_guide_use_case, is_capability_guide_job
FROM IDENTIFIER(:catalog || '.' || :schema || '.ops_job_runs')
WHERE result_state IN ('ERROR', 'FAILED', 'TIMED_OUT')
"""

spark.sql(SQL, args={k: params[k] for k in ("catalog", "schema", "lookback_days", "audit_lookback_days", "guide_tag_key", "use_case_tag_key") if f":{k}" in SQL})
display(spark.table(f"{fq}.ops_failures").limit(20))
