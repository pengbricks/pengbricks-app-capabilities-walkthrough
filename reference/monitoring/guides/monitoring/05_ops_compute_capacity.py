# Databricks notebook source
# MAGIC %md
# MAGIC # 5. Compute and capacity
# MAGIC
# MAGIC Serverless DBUs by workload type per day, and SQL warehouse scale and start/stop events per day, in one long table. The table uses `CREATE OR REPLACE`, so a rerun replaces it.

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
-- Compute and capacity signals in one long table:
--   source = serverless_usage  : DBUs by workload type per day
--   source = warehouse_event   : SQL warehouse scale and start/stop events per day
CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.ops_compute_capacity') AS
WITH ctx AS (
  SELECT workspace_id FROM IDENTIFIER(:catalog || '.' || :schema || '.ops_context')
)
SELECT u.usage_date AS capacity_date,
       'serverless_usage' AS source,
       coalesce(u.billing_origin_product, 'UNKNOWN') AS workload_type,
       CASE WHEN coalesce(u.product_features.is_serverless, false) THEN 'serverless' ELSE 'other' END AS detail,
       CAST(sum(u.usage_quantity) AS DOUBLE) AS value,
       'DBU' AS unit
FROM system.billing.usage u JOIN ctx USING (workspace_id)
WHERE u.usage_unit = 'DBU' AND u.usage_date >= date_sub(current_date(), CAST(:lookback_days AS INT))
GROUP BY u.usage_date, coalesce(u.billing_origin_product, 'UNKNOWN'),
         CASE WHEN coalesce(u.product_features.is_serverless, false) THEN 'serverless' ELSE 'other' END
UNION ALL
SELECT CAST(e.event_time AS DATE), 'warehouse_event', 'SQL_WAREHOUSE',
       concat(e.event_type, ' / ', e.warehouse_id),
       CAST(count(*) AS DOUBLE), 'events'
FROM system.compute.warehouse_events e JOIN ctx USING (workspace_id)
WHERE e.event_time >= date_sub(current_date(), CAST(:lookback_days AS INT))
GROUP BY CAST(e.event_time AS DATE), e.event_type, e.warehouse_id
"""

spark.sql(SQL, args={k: params[k] for k in ("catalog", "schema", "lookback_days", "audit_lookback_days", "guide_tag_key", "use_case_tag_key") if f":{k}" in SQL})
display(spark.table(f"{fq}.ops_compute_capacity").limit(20))
