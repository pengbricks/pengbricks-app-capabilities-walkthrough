-- Who changed a permission, and when. Replace <catalog> with your catalog.
-- Unity Catalog permission changes are metastore-level events: the top-level workspace_id column is 0,
-- and request_params['workspace_id'] holds the workspace.
-- status_code 200 is a change that applied; other codes are refused attempts.
-- Always filter on event_date: the table is partitioned by it and is large.
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
  AND request_params['securable_full_name'] LIKE '<catalog>.%'
ORDER BY event_time DESC;

-- Current state: explicit grants versus privileges inherited from the catalog.
SELECT schema_name, grantee, privilege_type, inherited_from
FROM <catalog>.information_schema.schema_privileges
WHERE schema_name LIKE '%access%'
ORDER BY schema_name, grantee, privilege_type;

SELECT table_schema, table_name, grantee, privilege_type, inherited_from
FROM <catalog>.information_schema.table_privileges
WHERE table_schema LIKE '%access%'
ORDER BY table_schema, table_name, grantee, privilege_type;
