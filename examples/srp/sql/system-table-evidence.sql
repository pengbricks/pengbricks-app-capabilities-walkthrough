-- Replace placeholders through parameter binding or generated SQL.
-- Keep bounded predicates because system tables can be large.

-- Job and task attempts, including retries.
SELECT
  workspace_id,
  job_id,
  run_id,
  period_start_time,
  period_end_time,
  result_state
FROM system.lakeflow.job_run_timeline
WHERE period_start_time >= current_timestamp() - INTERVAL 7 DAYS
  AND job_id = :job_id
ORDER BY period_start_time DESC;

SELECT
  workspace_id,
  job_id,
  run_id,
  task_key,
  period_start_time,
  period_end_time,
  result_state
FROM system.lakeflow.job_task_run_timeline
WHERE period_start_time >= current_timestamp() - INTERVAL 7 DAYS
  AND job_id = :job_id
ORDER BY period_start_time DESC;

-- Table lineage for the governed medallion path.
SELECT
  event_time,
  source_table_full_name,
  target_table_full_name
FROM system.access.table_lineage
WHERE event_date >= current_date() - 7
  AND target_table_full_name LIKE :target_table_pattern
ORDER BY event_time DESC;

-- Audit events associated with the guide run window.
SELECT
  event_time,
  user_identity.email AS actor,
  action_name,
  service_name,
  request_params
FROM system.access.audit
WHERE event_date >= current_date() - 7
  AND event_time BETWEEN :window_start AND :window_end
ORDER BY event_time DESC;

-- Usage attributed through public-safe resource tags.
SELECT
  usage_date,
  sku_name,
  custom_tags,
  SUM(usage_quantity) AS usage_quantity
FROM system.billing.usage
WHERE usage_date >= current_date() - 7
  AND custom_tags['demo'] = 'srp-reference'
GROUP BY usage_date, sku_name, custom_tags
ORDER BY usage_date DESC;
