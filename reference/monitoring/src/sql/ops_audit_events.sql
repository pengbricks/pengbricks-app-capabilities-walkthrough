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
