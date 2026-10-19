import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'access-management',
  area: 'Governance/Monitoring',
  title: 'Access management',
  intro:
    'One job grants two schemas to a group with different privileges, checks the grants in information_schema, reads the grant changes from the audit log, and lists the workspace’s service principals. It never grants to a person.',
  shortVersion: [
    {
      title: 'Grants go to a group.',
      body: 'Every GRANT targets one group. The grant builder rejects an email address, and a check fails the run if a person holds an explicit grant.',
    },
    {
      title: 'Dev and prod differ by privilege.',
      body: 'The dev-like schema allows read, write, and create. The prod-like schema allows reads on one table.',
    },
    {
      title: 'A workspace group is not enough.',
      body: 'Unity Catalog only grants to account-level groups. The job creates the workspace group, finds it is not grantable, and falls back to account users.',
    },
    {
      title: 'The audit log shows every change.',
      body: 'system.access.audit recorded 45 grant changes in the catalog over 30 days, including three refused attempts.',
    },
    {
      title: 'Credentials are listed, not read.',
      body: 'The service principal table shows roles, secret count, and expiry. The rotation procedure replaces a secret without downtime.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'How access is granted and checked',
      prose:
        'The job resolves which principal can receive grants, grants both environments from the use-case spec, and then proves the result from the catalog and the audit log.',
      diagram: {
        type: 'flow',
        title: 'From group to verified grants',
        description:
          'ensure_group creates the workspace group through the SDK and probes whether Unity Catalog can grant to it. If not, the job uses the account users group. apply_grants grants the dev-like schema read, write, and create, and the prod-like schema USE SCHEMA plus SELECT on orders. verify_grants reads information_schema and asserts the difference. audit_grant_changes queries system.access.audit.',
        lanes: [
          { label: 'Principal', fromRow: 0, toRow: 0 },
          { label: 'Grants and checks', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'group', label: 'ensure_group', mono: true, sub: 'SDK, workspace group', col: 0, row: 0 },
          { id: 'gate', label: 'Grantable?', sub: 'account-level only', col: 1, row: 0, kind: 'gate' },
          { id: 'reader', label: 'reader_group', mono: true, sub: 'if grantable', col: 2, row: 0 },
          { id: 'fallback', label: 'account users', sub: 'used in this run', col: 3, row: 0, kind: 'highlight' },
          { id: 'apply', label: 'apply_grants', mono: true, col: 1, row: 1, kind: 'highlight' },
          { id: 'dev', label: 'access_dev', mono: true, sub: 'read, write, create', col: 2, row: 1, kind: 'store' },
          { id: 'prod', label: 'access_prod', mono: true, sub: 'SELECT on orders', col: 3, row: 1, kind: 'store' },
          { id: 'verify', label: 'verify_grants', mono: true, sub: 'information_schema', col: 1, row: 2 },
          { id: 'audit', label: 'audit_grant_changes', mono: true, sub: 'system.access.audit', col: 2, row: 2 },
        ],
        edges: [
          { from: 'group', to: 'gate' },
          { from: 'gate', to: 'reader', label: 'yes' },
          { from: 'gate', to: 'fallback', label: 'no' },
          { from: 'fallback', to: 'apply' },
          { from: 'reader', to: 'apply', dashed: true },
          { from: 'apply', to: 'dev' },
          { from: 'apply', to: 'prod' },
          { from: 'apply', to: 'verify' },
          { from: 'apply', to: 'audit' },
        ],
        legend: [
          { kind: 'highlight', label: 'Principal that received grants' },
          { kind: 'gate', label: 'Probe by GRANT' },
          { kind: 'store', label: 'Schema' },
        ],
      },
    },
    {
      id: 'environments',
      examples: [
        {
          label: 'Inspect and revoke a grant by hand',
          language: 'sql',
          code: `SHOW GRANTS \`data-readers\` ON SCHEMA main.sales_prod;
REVOKE SELECT ON SCHEMA main.sales_prod FROM \`data-readers\`;
GRANT SELECT ON SCHEMA main.sales_prod TO \`data-readers\`;`,
          notes: ['Use the same group name the job grants to, so a manual change shows up in the audit task.'],
        },
      ],
      heading: 'Dev and prod, side by side',
      prose:
        'Both schemas hold the same two tables from the spec. The difference is the privilege set. Grants on the prod-like schema are at object level: one table, read only.',
      diagram: {
        type: 'matrix',
        title: 'What the group can do',
        description:
          'On the dev-like schema the group can use the schema, select, modify, and create tables, and it inherits select and modify on customers and orders. On the prod-like schema the group can use the schema and select from orders only. It has no access to customers and cannot modify or create.',
        corner: 'Environment ↓ · Object →',
        columns: ['Schema', 'customers', 'orders', 'Create tables'],
        rows: [
          {
            label: 'Dev-like',
            sub: 'access_dev',
            cells: [
              { state: 'own', text: 'USE SCHEMA' },
              { state: 'own', text: 'SELECT, MODIFY' },
              { state: 'own', text: 'SELECT, MODIFY' },
              { state: 'own', text: 'Yes' },
            ],
          },
          {
            label: 'Prod-like',
            sub: 'access_prod',
            cells: [
              { state: 'own', text: 'USE SCHEMA' },
              { state: 'none', text: 'No grant' },
              { state: 'own', text: 'SELECT' },
              { state: 'none', text: 'No' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Granted' },
          { state: 'none', label: 'Not granted' },
        ],
        caption:
          'On dev, SELECT and MODIFY on the tables are inherited from the schema grant (inherited_from = SCHEMA). On prod, the SELECT on orders is an explicit table grant (inherited_from = NONE).',
      },
    },
    {
      id: 'audit',
      heading: 'Who changed what',
      prose:
        'Unity Catalog permission changes are metastore-level audit events: the top-level workspace_id is 0 and the real workspace sits in request_params. The job scopes by catalog name. status_code separates applied changes from refused ones.',
      steps: [
        {
          title: 'Grant changes',
          body: 'sql/permission_audit_task.sql writes access_audit_grant_changes. In the reference run, 12 rows were on this guide’s schemas: nine with status 200 and three with status 404.',
          code: "SELECT event_time, user_identity.email AS actor,\n       request_params['securable_full_name'] AS securable,\n       request_params['changes'] AS changes,\n       response.status_code AS status_code\nFROM system.access.audit\nWHERE event_date >= current_date() - INTERVAL 30 DAYS\n  AND service_name = 'unityCatalog'\n  AND action_name = 'updatePermissions';",
        },
        {
          title: 'What the 404s are',
          body: 'The attempts to grant to the workspace-local group. The catalog refused them, and the audit log kept the attempts.',
        },
        {
          title: 'Current state',
          body: 'information_schema.schema_privileges and table_privileges list who holds what now, with inherited_from to separate explicit grants from cascades.',
        },
      ],
    },
    {
      id: 'principals',
      heading: 'Service principals and rotation',
      prose:
        'The job lists the workspace’s service principals with their group memberships (roles), entitlements, and OAuth secret metadata. It reads no secret values.',
      diagram: {
        type: 'flow',
        title: 'Rotating a service principal secret',
        description:
          'Create a second secret with a lifetime. Store it where the consumer reads it. Redeploy or restart the consumer and confirm it authenticates. Delete the old secret. Rerun the job and check the secret count and expiry in access_service_principals.',
        nodes: [
          { id: 'new', label: 'Create new secret', sub: 'with a lifetime', col: 0, row: 0 },
          { id: 'store', label: 'Store the secret', sub: 'secret scope or resource', col: 1, row: 0 },
          { id: 'switch', label: 'Restart the consumer', sub: 'confirm it authenticates', col: 2, row: 0, kind: 'gate' },
          { id: 'old', label: 'Delete old secret', col: 3, row: 0 },
          { id: 'check', label: 'Rerun the job', sub: 'count and expiry', col: 3, row: 1, kind: 'highlight' },
          { id: 'table', label: 'service principals', mono: true, sub: 'access_ table', col: 2, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'new', to: 'store' },
          { from: 'store', to: 'switch' },
          { from: 'switch', to: 'old', label: 'works' },
          { from: 'old', to: 'check' },
          { from: 'check', to: 'table' },
        ],
        legend: [
          { kind: 'gate', label: 'Do not delete before this passes' },
          { kind: 'highlight', label: 'Read-only check' },
        ],
      },
    },
  ],
  related: [
    { slug: 'row-column-security', title: 'Row and column security' },
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
  ],
};
