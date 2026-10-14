-- Audit the ingestion framework from Databricks system tables.
-- Parameters: :catalog and :schema are the bundle's catalog and schema
-- (in development mode the schema is prefixed, e.g. dev_<user>_capability_guides_ingestion).
-- System tables are account-wide; add a workspace_id filter to scope to one workspace.

-- 1. Transformation runs: every run of the framework job, how it was triggered, and the result.
WITH guide_jobs AS (
  SELECT workspace_id, job_id, name
  FROM system.lakeflow.jobs
  WHERE tags['capability_guide_job'] = 'capability_guides_ingestion_framework'
  QUALIFY row_number() OVER (PARTITION BY workspace_id, job_id ORDER BY change_time DESC) = 1
)
SELECT j.name AS job_name, r.run_id, r.trigger_type, r.run_type, r.result_state,
       min(r.period_start_time) AS started_at, max(r.period_end_time) AS ended_at
FROM system.lakeflow.job_run_timeline r
JOIN guide_jobs j USING (workspace_id, job_id)
WHERE r.period_start_time >= current_date() - INTERVAL 7 DAYS
GROUP BY ALL
ORDER BY started_at DESC;

-- 2. Pipeline updates: the streaming pipeline's updates, the identity they ran as, and the result.
WITH guide_pipelines AS (
  SELECT workspace_id, pipeline_id, name
  FROM system.lakeflow.pipelines
  WHERE tags['capability_guide_job'] = 'capability_guides_ingestion_streaming'
  QUALIFY row_number() OVER (PARTITION BY workspace_id, pipeline_id ORDER BY change_time DESC) = 1
)
SELECT p.name AS pipeline_name, u.update_id, u.update_type, u.trigger_type, u.run_as_user_name, u.result_state,
       min(u.period_start_time) AS started_at, max(u.period_end_time) AS ended_at
FROM system.lakeflow.pipeline_update_timeline u
JOIN guide_pipelines p USING (workspace_id, pipeline_id)
WHERE u.period_start_time >= current_date() - INTERVAL 7 DAYS
GROUP BY ALL
ORDER BY started_at DESC;

-- 3. Audit log: who created, changed, started, or repaired the job and pipeline.
WITH guide_resources AS (
  SELECT CAST(job_id AS STRING) AS resource_id FROM system.lakeflow.jobs
  WHERE tags['capability_guide_job'] LIKE 'capability_guides_%'
  UNION
  SELECT pipeline_id FROM system.lakeflow.pipelines
  WHERE tags['capability_guide_job'] LIKE 'capability_guides_%'
)
SELECT event_time, user_identity.email AS actor, service_name, action_name,
       coalesce(request_params['job_id'], request_params['pipeline_id']) AS resource_id,
       response.status_code
FROM system.access.audit
WHERE event_date >= current_date() - INTERVAL 7 DAYS
  AND service_name IN ('jobs', 'deltaPipelines')
  AND action_name IN ('create', 'update', 'reset', 'edit', 'delete', 'runNow', 'submitRun', 'repairRun',
                      'cancel', 'startUpdate', 'stop', 'changeJobAcl', 'changePipelineAcls')
  AND coalesce(request_params['job_id'], request_params['pipeline_id']) IN (SELECT resource_id FROM guide_resources)
ORDER BY event_time DESC;

-- 4. Lineage: which job or pipeline wrote each table in the schema, and from which source.
SELECT target_table_full_name, coalesce(source_table_full_name, source_path) AS source,
       entity_type, entity_id, created_by, max(event_time) AS last_seen
FROM system.access.table_lineage
WHERE target_table_catalog = :catalog
  AND target_table_schema = :schema
  AND event_date >= current_date() - INTERVAL 7 DAYS
GROUP BY ALL
ORDER BY last_seen DESC;

-- 5. Query activity: statements that read or wrote the framework's tables.
SELECT start_time, executed_by, statement_type, execution_status, total_duration_ms,
       read_rows, produced_rows, written_rows, client_application,
       query_source.job_info.job_id AS job_id,
       left(statement_text, 200) AS statement_preview
FROM system.query.history
WHERE start_time >= current_date() - INTERVAL 7 DAYS
  AND statement_text ILIKE concat('%', :schema, '.transactions_%')
ORDER BY start_time DESC;
