-- Failed, errored and timed-out runs, derived from ops_job_runs.
CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.ops_failures') AS
SELECT job_id, run_id, job_name, start_time, end_time, run_date, duration_min,
       result_state, coalesce(termination_code, 'UNKNOWN') AS termination_code,
       trigger_type, run_as, capability_guide_job, capability_guide_use_case, is_capability_guide_job
FROM IDENTIFIER(:catalog || '.' || :schema || '.ops_job_runs')
WHERE result_state IN ('ERROR', 'FAILED', 'TIMED_OUT')
