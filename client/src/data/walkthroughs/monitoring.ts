import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'monitoring',
  area: 'Governance/Monitoring',
  title: 'Platform observability',
  intro:
    'Databricks already records what your platform does: who accessed what, what ran, what it cost, how compute behaved, and which models were called. Those records are system tables in the system catalog, and they are the source for every dashboard and alert you build. This page maps each operational question to the system table that answers it, then covers how to expose the tables safely, what their scope and retention are, and which alerting features to use on top.',
  businessValue: {
    summary:
      'Platform owners need one place to answer who accessed what, what ran, and what it cost. Databricks records this in system tables, so security, finance, and operations teams can build dashboards and alerts without collecting logs.',
    outcomes: [
      {
        title: 'Audit evidence already exists',
        body:
          'system.access.audit records access and permission events, so a CISO can answer who touched what from a table query instead of requesting logs from each team.',
      },
      {
        title: 'Cost questions answered from billing',
        body:
          'system.billing.usage covers the whole account. Finance can see spend by workspace and product, and Budgets email an owner when monthly spend crosses a line.',
      },
      {
        title: 'Job failures reach the right person',
        body:
          'Lakeflow Jobs notifications and health rules flag failures and slow runs, so the owning team hears about a problem before a business user does.',
      },
      {
        title: 'Access to logs stays controlled',
        body:
          'Only admins read system tables by default. Teams get views limited to their own columns and workspaces, so monitoring does not widen who sees sensitive audit detail.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Start from the question, then pick the system table.',
      body: 'Audit, billing, Lakeflow, compute, query history, and Unity Gateway usage each answer a different class of question. One dashboard rarely needs more than a few of them.',
    },
    {
      title: 'Query tables directly or through views.',
      body: 'By default only admins can read system tables. Give teams a view that selects the columns and workspaces they need and grant on the view.',
    },
    {
      title: 'Know the scope.',
      body: 'Billing is account-wide. Audit, jobs, compute, and query history return the workspaces in the same region as the workspace you query from.',
    },
    {
      title: 'Alert where the signal lives.',
      body: 'Use Lakeflow Jobs notifications and health rules for job failures and slow runs, Budgets for spend, and SQL alerts for conditions you can only express in a query.',
    },
    {
      title: 'Plan for retention, lag, and masking.',
      body: 'Most tables keep 365 days, some keep 90 or 30. Records arrive minutes to an hour late. Statement text and some audit parameters are masked unless you have the right access.',
    },
  ],
  sections: [
    {
      id: 'map',
      heading: 'Which system table answers which question',
      prose:
        'Enable the system schemas you need once per metastore, then query them with SQL. Retention shown is the free retention period in the current documentation.',
      table: {
        caption: 'Questions and the tables that answer them',
        columns: ['Question', 'System table'],
        rows: [
          [
            'Who accessed or changed what, and from where?',
            'system.access.audit. Workspace events are regional; account-level events are global with workspace_id 0. 365 days.',
          ],
          [
            'What did we spend, and who or what drove it?',
            'system.billing.usage joined to system.billing.list_prices. Account-wide. 365 days. Use custom_tags, usage_metadata, and identity_metadata to attribute.',
          ],
          [
            'Did jobs and pipelines run, and which failed?',
            'system.lakeflow.job_run_timeline, job_task_run_timeline, jobs, pipelines, and pipeline_update_timeline. 365 days.',
          ],
          [
            'How are SQL warehouses and queries behaving?',
            'system.query.history, system.compute.warehouse_events, and system.compute.warehouses. 365 days.',
          ],
          [
            'Is classic compute sized well?',
            'system.compute.clusters and system.compute.node_timeline. node_timeline keeps 90 days.',
          ],
          [
            'Who is calling models, and how many tokens?',
            'system.ai_gateway.usage for Unity Gateway services (Public Preview, 365 days). system.serving.endpoint_usage covers serving endpoints that have usage tracking on (90 days).',
          ],
          [
            'What reads or writes this table?',
            'system.access.table_lineage and system.access.column_lineage. 365 days.',
          ],
          [
            'What did network policy block?',
            'system.access.outbound_network (365 days) and system.access.inbound_network (30 days).',
          ],
          [
            'Is the data fresh and complete?',
            'system.data_quality_monitoring.table_results from data quality monitoring. 13 months.',
          ],
        ],
      },
      links: [
        { label: 'System tables reference', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' },
        { label: 'Billing system tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing' },
        { label: 'Audit log system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/audit-logs' },
        { label: 'Jobs system tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/jobs' },
        { label: 'Compute system tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/compute' },
        {
          label: 'Query history system table',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/query-history',
        },
        { label: 'Unity Gateway', url: 'https://docs.databricks.com/aws/en/ai-gateway/' },
      ],
    },
    {
      id: 'expose',
      heading: 'Query directly, or share through views',
      prose:
        'Admins query system tables directly. Everyone else needs a path that does not hand out the whole table, because the tables cover every workspace in scope and every user. A view is that path.',
      diagram: {
        type: 'flow',
        title: 'From system tables to the people who need them',
        description:
          'System tables in the system catalog feed views in a catalog you own. The views filter by workspace and select a safe set of columns. Dashboards, SQL alerts, and team queries read the views, and consumers get SELECT on the views only.',
        nodes: [
          { id: 'sys', label: 'System tables', sub: 'audit, billing, lakeflow', col: 0, row: 0, kind: 'store' },
          { id: 'view', label: 'Views you own', sub: 'filtered, fewer columns', col: 1, row: 0, kind: 'highlight' },
          { id: 'dash', label: 'AI/BI dashboards', sub: 'trends and drill-down', col: 2, row: 0, kind: 'surface' },
          { id: 'alert', label: 'SQL alerts', sub: 'query-based conditions', col: 2, row: 1, kind: 'surface' },
          { id: 'team', label: 'Team queries', sub: 'SELECT on the view', col: 2, row: 2, kind: 'surface' },
        ],
        edges: [
          { from: 'sys', to: 'view' },
          { from: 'view', to: 'dash' },
          { from: 'view', to: 'alert' },
          { from: 'view', to: 'team' },
        ],
        legend: [
          { kind: 'store', label: 'System tables' },
          { kind: 'highlight', label: 'Governed view' },
          { kind: 'surface', label: 'Consumers' },
        ],
      },
      options: {
        caption: 'How people get at system table data',
        rows: [
          {
            option: 'Grant SELECT on the system tables',
            when: 'A small admin group needs every workspace and every column.',
            tradeoffs:
              'Nothing to build. The grant exposes every workspace in scope and every user, including audit detail, so keep the group small. Large tables such as billing and audit are slow to scan without a date filter.',
          },
          {
            option: 'Views you own over the system tables',
            when: 'Teams, dashboards, and alerts need part of the data.',
            tradeoffs:
              'Consumers get SELECT on the view and not on the table, and you can filter by workspace and drop columns. Someone owns the view definitions and has to update them when a system table schema changes. The view reads the system table at query time, so it does not make a slow query faster.',
          },
          {
            option: 'Scheduled copy into your own tables',
            when:
              'Dashboards are slow, you want history longer than the system tables keep, or you join with your own data.',
            tradeoffs:
              'Dashboards read a table you control, so they are faster and more predictable. You pay for a job and for storage, you maintain the pipeline, and the copy is only as fresh as its last run. You also set the grants and filters on the copy yourself.',
          },
        ],
        recommendation:
          'Start with views, which give least-privilege access with little to maintain. Move a view to a scheduled copy when dashboards are slow or you need history beyond what the system tables keep.',
      },
      examples: [
        {
          label: 'Failed job runs in the last day, as a view',
          language: 'sql',
          code: `CREATE OR REPLACE VIEW ops.monitoring.failed_job_runs AS
SELECT t.workspace_id, t.job_id, j.name AS job_name, t.run_id,
       t.result_state, t.period_end_time
FROM system.lakeflow.job_run_timeline t
JOIN (SELECT job_id, workspace_id, max_by(name, change_time) AS name
      FROM system.lakeflow.jobs GROUP BY job_id, workspace_id) j
  USING (job_id, workspace_id)
WHERE t.period_end_time >= current_timestamp() - INTERVAL 1 DAY
  AND t.result_state IN ('FAILED', 'ERROR', 'TIMED_OUT');

GRANT SELECT ON VIEW ops.monitoring.failed_job_runs TO \`platform-oncall\`;`,
          notes: [
            'The group needs USE CATALOG and USE SCHEMA, not access to the system tables.',
            'To limit a team to its own workspaces, add a WHERE clause on workspace_id or a mapping table.',
          ],
        },
        {
          label: 'Daily DBUs by product and workspace',
          language: 'sql',
          code: `SELECT usage_date, workspace_id, billing_origin_product, sum(usage_quantity) AS dbus
FROM system.billing.usage
WHERE usage_date >= current_date() - INTERVAL 30 DAYS
GROUP BY ALL
ORDER BY usage_date, dbus DESC;`,
          notes: ['Join system.billing.list_prices on sku_name and the price window to turn DBUs into dollars.'],
        },
      ],
      links: [
        {
          label: 'Manage privileges in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/',
        },
        {
          label: 'CREATE VIEW',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-view',
        },
      ],
    },
    {
      id: 'scope',
      heading: 'Account-wide versus per-workspace scope',
      prose:
        'System tables are not scoped to the workspace you query from. Read the scope column in the reference before you build a dashboard on a table.',
      points: [
        {
          strong: 'Global tables.',
          text: 'system.billing.usage, system.billing.list_prices, and account-level audit events cover the whole account. Filter by workspace_id when a team should see only its workspaces.',
        },
        {
          strong: 'Regional tables.',
          text: 'Audit workspace events, lakeflow, compute, query history, lineage, and ai_gateway usage return workspaces in the same region as the workspace you query from. A multi-region estate needs a query, or a copy, per region.',
        },
        {
          strong: 'Account events show workspace_id 0.',
          text: 'Account-console actions are logged with workspace_id 0 in system.access.audit. Do not filter them out by accident.',
        },
        {
          strong: 'Deleted workspaces lose audit detail.',
          text: 'When a workspace is deleted, its audit events older than 14 days are removed from system.access.audit.',
        },
      ],
    },
    {
      id: 'caveats',
      heading: 'Retention, lag, and masking',
      points: [
        {
          strong: 'Retention.',
          text: 'Free retention is 365 days for most tables, 90 days for node_timeline and endpoint_usage, and 30 days for inbound network events. For longer history, copy the rows you need into a table you own on a schedule, and keep that copy in Unity Catalog under the same access rules.',
        },
        {
          strong: 'Lag.',
          text: 'Records arrive after the event. Query history is typically available within an hour, and other tables vary. Alert on conditions with a window that tolerates the lag, and do not use system tables where you need seconds.',
        },
        {
          strong: 'Masking.',
          text: 'In system.query.history, statement_text returns <REDACTED> unless you are an account admin or a member of the databricks_pii_access account group. The audit table omits request_params keys that contain SQL definitions for everyone else. Grant that group only to people who need the text.',
        },
        {
          strong: 'Reading the tables.',
          text: 'Filter on the date column (event_date, usage_date) before the timestamp. These tables are large, and a date filter lets the engine skip files.',
        },
      ],
    },
    {
      id: 'alerting',
      heading: 'Alert with Lakeflow Jobs notifications and health rules first',
      prose:
        'Job and pipeline health has native alerting, and it is more reliable than a query over system tables because it does not depend on table lag.',
      table: {
        columns: ['Signal', 'Feature'],
        rows: [
          ['Start, success, or failure of a run or task', 'Job or task notifications to email or a system destination'],
          [
            'A run takes longer than expected',
            'Set an expected duration, then turn on the Duration warning notification',
          ],
          ['A streaming task falls behind', 'Streaming backlog threshold and notification (not for pipeline tasks)'],
          [
            'A failed task that retries',
            'Task-level notifications. Job-level notifications are not sent when a failed task is retried.',
          ],
          ['Spend crosses a limit', 'Budgets'],
          [
            'A condition only a query can express',
            'A SQL alert over a view; evaluation history is in system.alert.alert_evaluation_history',
          ],
        ],
      },
      points: [
        {
          strong: 'Notification destinations.',
          text: 'An admin configures system destinations once (Slack, Microsoft Teams, PagerDuty, or a webhook). Each job or task can use up to three per event type. Use a webhook when you need a stable payload, because chat message formats can change.',
        },
        {
          strong: 'Permissions.',
          text: 'You need CAN MANAGE or IS OWNER on the job to change its notifications. Set them in the bundle so every deployment has them.',
        },
      ],
      links: [
        { label: 'Add notifications on a job', url: 'https://docs.databricks.com/aws/en/jobs/notifications' },
        { label: 'Monitor Lakeflow Jobs', url: 'https://docs.databricks.com/aws/en/jobs/monitor' },
      ],
    },
    {
      id: 'cost-alerts',
      heading: 'Use Budgets for cost alerts',
      prose:
        'Budgets (generally available) track spend in USD at list price and email you when it crosses a threshold. An account admin creates them in the account console, scoped to the whole account or filtered by workspace, product, or custom tag.',
      points: [
        {
          strong: 'Thresholds.',
          text: 'Up to four monthly thresholds per budget, each with its own email list. Recipients do not need Databricks accounts.',
        },
        {
          strong: 'Scope by tag.',
          text: 'Filter a budget on custom tags so a team sees its own spend. Tag the workloads first; untagged spend never lands in a tag-scoped budget.',
        },
        {
          strong: 'Unity Gateway budgets.',
          text: 'A budget scoped to Unity Gateway can set per-user thresholds and optionally block further requests when a threshold is reached.',
        },
        {
          strong: 'Use system tables for drill-down.',
          text: 'The budget says that spend crossed a line. system.billing.usage says why.',
        },
      ],
      links: [
        {
          label: 'Create and monitor budgets',
          url: 'https://docs.databricks.com/aws/en/admin/account-settings/budgets',
        },
        { label: 'Cost management tools', url: 'https://docs.databricks.com/aws/en/admin/usage/' },
      ],
    },
  ],
  related: [
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
    { slug: 'operational-support', title: 'Support and recovery' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
  ],
};
