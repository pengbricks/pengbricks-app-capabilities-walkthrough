-- One row per job run in the lookback window, for the whole workspace.
-- is_capability_guide_job and the two tag columns let the dashboard filter to guide jobs.
CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.ops_job_runs') AS
WITH ctx AS (
  SELECT workspace_id FROM IDENTIFIER(:catalog || '.' || :schema || '.ops_context')
),
latest_jobs AS (
  SELECT j.*
  FROM system.lakeflow.jobs j JOIN ctx USING (workspace_id)
  WHERE j.delete_time IS NULL
  QUALIFY row_number() OVER (PARTITION BY j.job_id ORDER BY j.change_time DESC) = 1
),
runs AS (
  SELECT t.job_id, t.run_id,
         min(t.period_start_time) AS start_time,
         max(t.period_end_time) AS end_time,
         max(t.result_state) AS result_state,
         max(t.termination_code) AS termination_code,
         max(t.trigger_type) AS trigger_type,
         max(t.run_type) AS run_type
  FROM system.lakeflow.job_run_timeline t JOIN ctx USING (workspace_id)
  WHERE t.period_end_time >= date_sub(current_date(), CAST(:lookback_days AS INT))
  GROUP BY t.job_id, t.run_id
)
SELECT r.job_id,
       r.run_id,
       coalesce(j.name, concat('job ', r.job_id)) AS job_name,
       r.start_time,
       r.end_time,
       CAST(r.start_time AS DATE) AS run_date,
       round((unix_timestamp(r.end_time) - unix_timestamp(r.start_time)) / 60.0, 2) AS duration_min,
       coalesce(r.result_state, 'RUNNING') AS result_state,
       r.termination_code,
       r.trigger_type,
       r.run_type,
       coalesce(j.run_as_user_name, j.run_as) AS run_as,
       coalesce(j.tags[:guide_tag_key], '') AS capability_guide_job,
       coalesce(j.tags[:use_case_tag_key], '') AS capability_guide_use_case,
       j.tags[:guide_tag_key] IS NOT NULL AS is_capability_guide_job
FROM runs r LEFT JOIN latest_jobs j USING (job_id)
