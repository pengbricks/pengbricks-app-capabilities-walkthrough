-- Findings by status, then the ones that need attention. Runs as a SQL task on the warehouse.
-- :catalog and :schema come from the job's sql_task parameters.
SELECT status, count(*) AS checks
FROM IDENTIFIER(:catalog || '.' || :schema || '.environment_layout_audit')
GROUP BY status
ORDER BY status;

SELECT check, finding
FROM IDENTIFIER(:catalog || '.' || :schema || '.environment_layout_audit')
WHERE status = 'warn'
ORDER BY check;
