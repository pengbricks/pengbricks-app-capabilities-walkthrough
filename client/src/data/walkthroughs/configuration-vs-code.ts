import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'configuration-vs-code',
  area: 'Ingestion',
  title: 'Configuration-driven ingestion',
  intro:
    'Two providers send the same records in different shapes. Their differences live in configuration and one small adapter. Reading, validation, quarantine, upsert, audit, and error handling run through one shared framework.',
  shortVersion: [
    {
      title: 'Sources differ in configuration.',
      body: 'Format, file options, column mapping, and the adapter name are the only per-feed settings.',
    },
    {
      title: 'Provider code is one file.',
      body: 'Provider A needs a status-code lookup, so it gets a 20-line adapter. Provider B needs none.',
    },
    {
      title: 'Rules are declared once.',
      body: 'The use-case spec lists the rules. Every feed is validated with the same compiled SQL.',
    },
    {
      title: 'Bad rows are kept, not dropped.',
      body: 'Rows that fail a rule go to a quarantine table with the names of the rules they failed.',
    },
    {
      title: 'Every run is audited.',
      body: 'Each feed writes an audit row, an alert watches the quarantine rate, and system tables show who ran what.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'How a feed runs',
      prose:
        'Configuration is rendered from the use-case spec and committed to Git. The job lands files, then runs the same framework task once per feed. Every feed writes to the same three tables.',
      diagram: {
        type: 'flow',
        title: 'From use-case spec to ingested tables',
        description:
          'The use-case spec is rendered into one feed configuration per provider. The job lands files, runs the shared framework once per feed through a for-each task, and compares the feeds. The framework writes valid rows to transactions_silver, rejected rows to transactions_quarantine, and one row per feed to audit_log.',
        lanes: [
          { label: 'Configuration in Git', fromRow: 0, toRow: 0 },
          { label: 'Lakeflow job', fromRow: 1, toRow: 1 },
          { label: 'Unity Catalog tables', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'spec', label: 'Use-case spec', sub: 'use_cases/general.yml', col: 0, row: 0 },
          { id: 'render', label: 'Renderer', sub: 'render_use_case.py', col: 1, row: 0 },
          { id: 'feeds', label: 'Feed configs', sub: 'feeds/general/*.yml', col: 2, row: 0, kind: 'surface' },
          { id: 'land', label: 'land_files', mono: true, sub: 'dbldatagen, fixed seed', col: 0, row: 1 },
          { id: 'each', label: 'ingest_each_feed', mono: true, sub: 'for each feed', col: 1, row: 1 },
          { id: 'run', label: 'run_feed.py', mono: true, sub: 'shared framework', col: 2, row: 1, kind: 'highlight' },
          { id: 'compare', label: 'compare_feeds', mono: true, sub: 'fail if any feed fails', col: 3, row: 1 },
          { id: 'silver', label: 'transactions_silver', mono: true, col: 1, row: 2, kind: 'store' },
          { id: 'quarantine', label: 'transactions_quarantine', mono: true, col: 2, row: 2, kind: 'store' },
          { id: 'audit', label: 'audit_log', mono: true, col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'spec', to: 'render' },
          { from: 'render', to: 'feeds' },
          { from: 'feeds', to: 'run', label: 'read at run time' },
          { from: 'land', to: 'each' },
          { from: 'each', to: 'run' },
          { from: 'run', to: 'compare' },
          { from: 'run', to: 'quarantine' },
          { from: 'each', to: 'silver' },
          { from: 'compare', to: 'audit' },
        ],
        legend: [
          { kind: 'highlight', label: 'Shared framework, same code for every feed' },
          { kind: 'surface', label: 'Generated configuration' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'rules',
      heading: 'Rules, quarantine, and alerts',
      prose:
        'Each mapped row is checked against the shared rules. Rows that pass are merged into silver. Rows that fail are written to quarantine with their failed rule names. The audit row counts both, and a SQL alert emails the owner when the quarantine rate crosses the threshold.',
      diagram: {
        type: 'flow',
        title: 'What happens to each row',
        description:
          'A landed file is read by the adapter and mapped to canonical columns. The shared rules are applied. Rows that pass every rule are merged into transactions_silver. Rows that fail any rule go to transactions_quarantine with an array of failed rule names. The feed audit row records read, valid, and quarantined counts. A SQL alert reads the audit table hourly and emails the owner when the quarantine rate is above the threshold. A feed error marks the audit row failed and triggers the job retry and failure email.',
        nodes: [
          { id: 'file', label: 'Landed file', sub: 'CSV or JSON', col: 0, row: 0, kind: 'store' },
          { id: 'adapter', label: 'Adapter', sub: 'map to canonical columns', col: 1, row: 0 },
          { id: 'rules', label: 'Shared rules', sub: 'not_null, allowed_values', col: 2, row: 0, kind: 'highlight' },
          { id: 'gate', label: 'All rules pass?', col: 3, row: 0, kind: 'gate' },
          {
            id: 'silver',
            label: 'transactions_silver',
            mono: true,
            sub: 'MERGE on feed + key',
            col: 4,
            row: 0,
            kind: 'store',
          },
          {
            id: 'quarantine',
            label: 'transactions_quarantine',
            mono: true,
            sub: '_quarantine_reasons',
            col: 3,
            row: 1,
            kind: 'store',
          },
          {
            id: 'audit',
            label: 'audit_log',
            mono: true,
            sub: 'read, valid, quarantined',
            col: 2,
            row: 2,
            kind: 'store',
          },
          { id: 'alert', label: 'SQL alert', sub: 'quarantine_pct > 5', col: 3, row: 2, kind: 'surface' },
          { id: 'owner', label: 'Owner email', sub: 'notification_email', col: 4, row: 2 },
          { id: 'error', label: 'Feed error', sub: 'audit status FAILED', col: 1, row: 2 },
        ],
        edges: [
          { from: 'file', to: 'adapter' },
          { from: 'adapter', to: 'rules' },
          { from: 'rules', to: 'gate' },
          { from: 'gate', to: 'silver', label: 'pass' },
          { from: 'gate', to: 'quarantine', label: 'fail' },
          { from: 'rules', to: 'audit', label: 'counts' },
          { from: 'audit', to: 'alert' },
          { from: 'alert', to: 'owner', label: 'hourly' },
          { from: 'error', to: 'audit' },
        ],
        legend: [
          { kind: 'highlight', label: 'Rules from the use-case spec' },
          { kind: 'gate', label: 'Row-level decision' },
          { kind: 'surface', label: 'Alert' },
        ],
        caption:
          'A feed error also fails the task, so the job retry policy and failure email apply (see Pipeline operations).',
      },
    },
    {
      id: 'caught',
      heading: 'What each rule caught',
      prose:
        'The reference run lands 2,000 provider A rows and 1,500 provider B rows with deterministic bad rows. Both feeds trip the same rules because the rules are shared. A row can fail more than one rule.',
      diagram: {
        type: 'matrix',
        title: 'Quarantined rows by rule and feed',
        description:
          'For the reference run: record_id_present caught 29 provider A rows and 22 provider B rows; amount_non_negative caught 54 and 41; currency_supported caught 38 and 29; event_ts_present and status_known caught none.',
        corner: 'Rule ↓ · Feed →',
        columns: ['provider_a', 'provider_b'],
        rows: [
          {
            label: 'record_id_present',
            sub: 'not_null',
            cells: [
              { state: 'own', text: '29 rows' },
              { state: 'own', text: '22 rows' },
            ],
          },
          {
            label: 'amount_non_negative',
            sub: 'amount >= 0',
            cells: [
              { state: 'own', text: '54 rows' },
              { state: 'own', text: '41 rows' },
            ],
          },
          {
            label: 'currency_supported',
            sub: 'USD, EUR, GBP',
            cells: [
              { state: 'own', text: '38 rows' },
              { state: 'own', text: '29 rows' },
            ],
          },
          {
            label: 'event_ts_present',
            sub: 'not_null',
            cells: [
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
            ],
          },
          {
            label: 'status_known',
            sub: 'not_null',
            cells: [
              { state: 'none', text: 'none' },
              { state: 'none', text: 'none' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Rows quarantined by this rule' },
          { state: 'none', label: 'No rows caught' },
        ],
        caption: 'Totals: provider A 1,881 valid and 119 quarantined; provider B 1,408 valid and 92 quarantined.',
      },
    },
    {
      id: 'config',
      heading: 'What differs between the two feeds',
      prose: 'Everything in this table is configuration. Nothing outside it changes per provider.',
      table: {
        columns: ['Setting', 'provider_a / provider_b'],
        rows: [
          ['format', 'csv with header / json'],
          ['adapter', 'provider_a (status-code lookup) / generic'],
          ['record_id', 'TXN_ID / id'],
          ['account_id', 'ACCT_NO / account.number'],
          ['event_ts', "to_timestamp(TXN_DATE, 'MM/dd/yyyy HH:mm:ss') / to_timestamp(occurred_at)"],
          ['amount', 'AMOUNT_CENTS / 100 / amount.value'],
          ['currency', 'CCY / amount.currency'],
          ['status', 'decoded STATUS_CD / lower(state)'],
          ['rules', 'shared / shared'],
        ],
      },
    },
    {
      id: 'audit',
      heading: 'Audit it from system tables',
      prose:
        'The framework writes its own audit_log. Databricks system tables add who ran or changed the job and pipeline, what wrote each table, and which SQL read it. All five queries are in reference/ingestion/sql/audit_system_tables.sql.',
      steps: [
        {
          title: 'Transformation runs',
          body: 'system.lakeflow.job_run_timeline joined to jobs by the capability_guide_job tag: every run, its trigger, and its result.',
        },
        {
          title: 'Pipeline updates',
          body: 'system.lakeflow.pipeline_update_timeline: each streaming pipeline update, the identity it ran as, and the result.',
        },
        {
          title: 'Who changed or started them',
          body: 'system.access.audit for the jobs and deltaPipelines services: create, edit, runNow, startUpdate, repairRun, and permission changes.',
          code: "SELECT event_time, user_identity.email AS actor, service_name, action_name\nFROM system.access.audit\nWHERE service_name IN ('jobs', 'deltaPipelines')\n  AND action_name IN ('create', 'edit', 'runNow', 'startUpdate', 'repairRun')\nORDER BY event_time DESC;",
        },
        {
          title: 'Lineage',
          body: 'system.access.table_lineage: which job or pipeline wrote each table in the schema, and from which source. Spark jobs show up here.',
        },
        {
          title: 'Query activity',
          body: 'system.query.history: SQL warehouse statements that read or wrote the framework tables, with duration and row counts.',
        },
      ],
    },
  ],
  related: [
    { slug: 'reusability-templatization', title: 'Reusable ingestion templates' },
    { slug: 'dataops', title: 'Pipeline operations' },
  ],
};
