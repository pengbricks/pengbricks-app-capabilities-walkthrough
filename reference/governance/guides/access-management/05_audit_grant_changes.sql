-- Grant changes in one catalog over the last 30 days. Runs as a SQL task on the warehouse.
-- Safe to rerun: every table is created with CREATE OR REPLACE.
-- Parameters: :catalog, :schema.
-- Unity Catalog permission changes are metastore-level events, so the top-level workspace_id is 0.
-- The catalog is the scope here. status_code 200 is a change that applied; other codes are refused attempts.
CREATE OR REPLACE TABLE IDENTIFIER(:catalog || '.' || :schema || '.access_audit_grant_changes') AS
SELECT event_time,
       user_identity.email                   AS actor,
       action_name,
       request_params['securable_type']      AS securable_type,
       request_params['securable_full_name'] AS securable,
       request_params['changes']             AS changes,
       response.status_code                  AS status_code
FROM system.access.audit
WHERE event_date >= current_date() - INTERVAL 30 DAYS
  AND service_name = 'unityCatalog'
  AND action_name IN ('updatePermissions', 'updateSharePermissions')
  AND request_params['securable_full_name'] LIKE concat(:catalog, '.%')
ORDER BY event_time DESC;
