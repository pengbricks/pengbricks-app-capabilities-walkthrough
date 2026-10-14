import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'platform-administration',
  area: 'Governance/Monitoring',
  title: 'Workspace and account administration',
  intro:
    'One job scripts the routine administrator tasks with the Databricks SDK: read workspace settings, ensure a group and a policy, review warehouse capacity and serverless usage, read the audit log, and list failed jobs. Every step is idempotent and writes a row to the admin_actions table.',
  shortVersion: [
    {
      title: 'Seven tasks, one ledger.',
      body: 'Each task runs the same script with a different --task value and records what it checked or changed in admin_actions.',
    },
    {
      title: 'Re-runs change nothing.',
      body: 'The second run found the group and the cluster policy already in place and recorded both as unchanged.',
    },
    {
      title: 'Only capability-guides- objects change.',
      body: 'The script asserts the name prefix before it creates anything. It never deletes.',
    },
    {
      title: 'Refusals are recorded, not hidden.',
      body: 'The workspace rejected a budget policy and a Unity Catalog grant to a workspace group. Both show as not_allowed with the reason.',
    },
    {
      title: 'Audit and billing come from system tables.',
      body: 'system.access.audit and system.billing.usage answer who changed what and how much serverless compute ran.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'How the job runs',
      prose:
        'The tasks run one after another because they all write to one Delta table. Each task reads the admin section of the use-case spec, calls the SDK or a system table, and merges its rows into admin_actions keyed by run, category, action, and target.',
      diagram: {
        type: 'flow',
        title: 'From spec to admin_actions',
        description:
          'The use-case spec feeds platform_admin.py. The job runs init_ledger, workspace_checks, roles, policies, capacity, audit_access, and routine_support in order. SDK calls and system table queries produce rows that merge into admin_actions.',
        lanes: [
          { label: 'Inputs', fromRow: 0, toRow: 0 },
          { label: 'Lakeflow job', fromRow: 1, toRow: 2 },
          { label: 'Outputs', fromRow: 3, toRow: 3 },
        ],
        nodes: [
          { id: 'spec', label: 'Use-case spec', sub: 'use_cases/general.yml', col: 0, row: 0 },
          { id: 'sdk', label: 'Databricks SDK', sub: 'groups, policies, jobs', col: 1, row: 0, kind: 'surface' },
          { id: 'sys', label: 'System tables', sub: 'audit and billing', col: 2, row: 0, kind: 'surface' },
          { id: 'init', label: 'init_ledger', mono: true, col: 0, row: 1 },
          { id: 'ws', label: 'workspace_checks', mono: true, col: 1, row: 1 },
          { id: 'roles', label: 'roles', mono: true, col: 2, row: 1 },
          { id: 'pol', label: 'policies', mono: true, col: 3, row: 1 },
          { id: 'cap', label: 'capacity', mono: true, col: 0, row: 2 },
          { id: 'aud', label: 'audit_access', mono: true, col: 1, row: 2 },
          { id: 'sup', label: 'routine_support', mono: true, col: 2, row: 2 },
          { id: 'ledger', label: 'admin_actions', mono: true, sub: 'one row per action', col: 1, row: 3, kind: 'store' },
        ],
        edges: [
          { from: 'spec', to: 'init' },
          { from: 'init', to: 'ws' },
          { from: 'ws', to: 'roles' },
          { from: 'roles', to: 'pol' },
          { from: 'pol', to: 'cap' },
          { from: 'cap', to: 'aud' },
          { from: 'aud', to: 'sup' },
          { from: 'sdk', to: 'roles', dashed: true },
          { from: 'sys', to: 'aud', dashed: true },
          { from: 'aud', to: 'ledger', label: 'MERGE' },
        ],
        legend: [
          { kind: 'surface', label: 'Platform API or system table' },
          { kind: 'store', label: 'Delta table' },
        ],
        caption: 'The reference run wrote 53 rows. Re-running the job updates those rows by key and adds one set per run.',
      },
    },
    {
      id: 'coverage',
      heading: 'Which task covers which duty',
      prose: 'Each administration duty maps to one task, the API it uses, and what the ledger records.',
      diagram: {
        type: 'matrix',
        title: 'Administration duties and their records',
        description:
          'Six duties across what the task does, how it stays idempotent, and what the reference run recorded. Workspace setup read five settings. Roles ensured a group and found a Unity Catalog grant refused. Policies applied a cluster policy after a budget policy was refused. Capacity listed one warehouse and ten serverless SKUs. Audit read sixteen service and action pairs. Support listed failed jobs.',
        corner: 'Duty ↓ · Detail →',
        columns: ['Task', 'Idempotence', 'Reference run'],
        rows: [
          {
            label: 'Workspace setup',
            sub: 'settings and identity',
            cells: [
              { state: 'own', text: 'workspace_checks', sub: 'workspace_conf, metastore' },
              { state: 'own', text: 'Read only', sub: 'nothing to change' },
              { state: 'own', text: '8 rows ok', sub: '5 settings checked' },
            ],
          },
          {
            label: 'Role administration',
            sub: 'group and grants',
            cells: [
              { state: 'own', text: 'roles', sub: 'groups.list, create' },
              { state: 'own', text: 'Find, then create', sub: 'grant only if missing' },
              { state: 'optional', text: 'Grant refused', sub: 'group is not a UC principal' },
            ],
          },
          {
            label: 'Policy configuration',
            sub: 'budget or cluster',
            cells: [
              { state: 'own', text: 'policies', sub: 'budget, then cluster' },
              { state: 'own', text: 'Find by name', sub: 'edit only on drift' },
              { state: 'optional', text: 'Cluster policy kept', sub: 'budget policy refused' },
            ],
          },
          {
            label: 'Capacity',
            sub: 'warehouses and usage',
            cells: [
              { state: 'own', text: 'capacity', sub: 'warehouses, billing' },
              { state: 'own', text: 'Read only', sub: 'flags, no changes' },
              { state: 'own', text: '12 rows ok', sub: '1 warehouse, 10 SKUs' },
            ],
          },
          {
            label: 'Audit access',
            sub: 'last 7 days',
            cells: [
              { state: 'own', text: 'audit_access', sub: 'system.access.audit' },
              { state: 'own', text: 'Read only', sub: 'date-filtered query' },
              { state: 'own', text: '16 rows ok', sub: '15 pairs plus summary' },
            ],
          },
          {
            label: 'Routine support',
            sub: 'failures and tokens',
            cells: [
              { state: 'own', text: 'routine_support', sub: 'jobs, token_management' },
              { state: 'own', text: 'Read only', sub: 'lists, no changes' },
              { state: 'optional', text: '9 rows flagged', sub: '7 failed runs listed' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Completed as designed' },
          { state: 'optional', label: 'Flagged or refused by the workspace' },
        ],
      },
    },
    {
      id: 'refusals',
      heading: 'What the workspace refused',
      prose:
        'Some administration needs privileges or APIs a workspace does not offer. The job records the refusal and the reason, then continues with the closest alternative.',
      table: {
        columns: ['Attempt', 'Result in the reference run'],
        rows: [
          ['Serverless budget policy', 'not_allowed: the budget-policies API returned Not Found at the workspace level. The job applied a cluster policy instead.'],
          ['GRANT USE SCHEMA, SELECT to the group', 'not_allowed: PRINCIPAL_DOES_NOT_EXIST. Unity Catalog only sees account-level groups.'],
          ['Workspace-level equivalent', 'ok: CAN_USE on capability-guides-policy for the group, through the permissions API.'],
          ['Group create on a re-run', 'unchanged: the group already existed, so nothing was created.'],
        ],
      },
    },
    {
      id: 'audit',
      heading: 'Read it back',
      prose: 'The ledger is a table, so the evidence is a query. The audit task itself reads system.access.audit with a date filter.',
      steps: [
        {
          title: 'What did the job do?',
          body: 'Filter one run by category to see its checks and changes.',
          code: "SELECT category, action, target, status, detail\nFROM <catalog>.<schema>.admin_actions\nWHERE run_id = '<run id>' AND status <> 'ok'\nORDER BY category;",
        },
        {
          title: 'Who changed administration objects?',
          body: 'The audit task groups the last 7 days by service and action. Create, update, grant, and permission actions are kept.',
          code: "SELECT service_name, action_name, COUNT(*) AS events\nFROM system.access.audit\nWHERE event_date >= date_sub(current_date(), 7)\n  AND service_name IN ('groups', 'clusterPolicies', 'unityCatalog', 'jobs')\nGROUP BY 1, 2 ORDER BY events DESC;",
        },
        {
          title: 'How much serverless compute ran?',
          body: 'The capacity task sums system.billing.usage by serverless SKU over 30 days.',
        },
      ],
    },
  ],
  related: [
    { slug: 'operational-support', title: 'Support and recovery' },
    { slug: 'monitoring', title: 'Platform observability' },
  ],
};
