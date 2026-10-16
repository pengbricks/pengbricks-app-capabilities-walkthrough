# Databricks notebook source
# MAGIC %md
# MAGIC # 6. Audit events
# MAGIC
# MAGIC Audit events by day, service, action and user for this workspace. The table uses `CREATE OR REPLACE`, so a rerun replaces it.

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
-- Audit events by day, service, action and user for this workspace.
CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.ops_audit_events') AS
WITH ctx AS (
  SELECT workspace_id FROM IDENTIFIER(:catalog || '.' || :schema || '.ops_context')
)
SELECT a.event_date, a.service_name, a.action_name,
       coalesce(a.user_identity.email, 'unknown') AS user_email,
       count(*) AS events,
       sum(CASE WHEN a.response.status_code >= 400 THEN 1 ELSE 0 END) AS failed_events
FROM system.access.audit a JOIN ctx USING (workspace_id)
WHERE a.event_date >= date_sub(current_date(), CAST(:audit_lookback_days AS INT))
GROUP BY a.event_date, a.service_name, a.action_name, coalesce(a.user_identity.email, 'unknown')
"""

spark.sql(SQL, args={k: params[k] for k in ("catalog", "schema", "lookback_days", "audit_lookback_days", "guide_tag_key", "use_case_tag_key") if f":{k}" in SQL})
display(spark.table(f"{fq}.ops_audit_events").limit(20))
