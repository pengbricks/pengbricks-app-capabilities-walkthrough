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
