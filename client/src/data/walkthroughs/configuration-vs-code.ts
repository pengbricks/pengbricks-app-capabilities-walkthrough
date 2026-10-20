import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'configuration-vs-code',
  area: 'Ingestion',
  title: 'Metadata-driven ingestion',
  intro:
    'Metadata-driven ingestion describes each source in configuration and runs every source through one shared code path. Onboarding a source becomes a reviewed config change. This page covers what belongs in configuration, which platform features to use before you write a custom runner, and how to keep source quirks from spreading into shared code.',
  shortVersion: [
    {
      title: 'Put what differs per source in configuration.',
      body: 'Format, file options, column mapping, keys, and quality rules change per source. Reading, validating, upserting, and auditing do not, so they live in shared code.',
    },
    {
      title: 'Use the platform before a custom runner.',
      body: 'Pipeline expectations validate rows, AUTO CDC handles upserts and deduplication, and a for_each task runs one job per configured source. Hand-roll only what these do not cover.',
    },
    {
      title: 'Isolate source quirks.',
      body: 'When a source needs real code, such as a status-code lookup, put it behind a small adapter with one interface. The shared path stays unchanged.',
    },
    {
      title: 'Validate the configuration itself.',
      body: 'Parse each config into a typed object at load time and reject one that omits a required column. A bad config fails fast instead of writing bad data.',
    },
    {
      title: 'Keep bad rows and audit every run.',
      body: 'Route rejected rows to a quarantine table with the rule that failed, write an audit record per run, and alert on the reject rate.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'The shape of the pattern',
      prose:
        'Configuration lives in Git and deploys with the bundle. A job reads the list of configured sources and runs the same task once per source. Every source writes to the same standard outputs.',
      diagram: {
        type: 'flow',
        title: 'From source config to standard outputs',
        description:
          'Source configurations are stored in Git. A job with a for-each task runs one shared ingestion task per configured source. The shared task applies the source configuration through an adapter, validates rows, merges valid rows into a target table, writes rejected rows to a quarantine table, and records an audit row.',
        lanes: [
          { label: 'Configuration in Git', fromRow: 0, toRow: 0 },
          { label: 'Lakeflow Jobs', fromRow: 1, toRow: 1 },
          { label: 'Unity Catalog tables', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'cfg', label: 'Source configs', sub: 'one file per source', col: 0, row: 0, kind: 'surface' },
          { id: 'schema', label: 'Typed config model', sub: 'validated at load', col: 1, row: 0 },
          { id: 'each', label: 'for_each task', sub: 'one run per source', col: 0, row: 1 },
          { id: 'run', label: 'Shared ingestion code', sub: 'same for every source', col: 1, row: 1, kind: 'highlight' },
          { id: 'target', label: 'Target table', sub: 'MERGE on the key', col: 0, row: 2, kind: 'store' },
          { id: 'quarantine', label: 'Quarantine table', sub: 'rows plus failed rules', col: 1, row: 2, kind: 'store' },
          { id: 'audit', label: 'Audit table', sub: 'one row per run', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'cfg', to: 'schema' },
          { from: 'schema', to: 'run', label: 'read at run time' },
          { from: 'each', to: 'run' },
          { from: 'run', to: 'target' },
          { from: 'run', to: 'quarantine' },
          { from: 'run', to: 'audit' },
        ],
        legend: [
          { kind: 'highlight', label: 'Shared code, no per-source branches' },
          { kind: 'surface', label: 'Configuration' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'native',
      heading: 'Use the platform before a custom runner',
      prose:
        'A custom runner is code you own: tests, upgrades, and on-call. For most feeds the platform covers the same ground.',
      table: {
        caption: 'Native feature or custom code',
        columns: ['Need', 'Use the platform feature unless'],
        rows: [
          [
            'Row-level quality rules',
            'Pipeline expectations (warn, drop, or fail per rule) record pass and fail counts in the event log. Write a custom validator only when you must store the failed rule names per row, then pair it with a quarantine table.',
          ],
          [
            'Upserts, deduplication, SCD',
            'AUTO CDC takes a key, a sequence column, and SCD type 1 or 2, and handles out-of-order data. Write MERGE yourself only for logic beyond key and sequence.',
          ],
          [
            'Run the same logic per source',
            'A for_each task with a job parameter or an input list runs one task per source with built-in retries and a run history. Fall back to a loop in code only when sources must share one Spark session.',
          ],
          [
            'Discover new files',
            'Auto Loader (read_files in a streaming table) tracks files already read. Do not list directories and keep your own state.',
          ],
          [
            'Whole pipelines from metadata',
            'Generate pipeline definitions from config with a small Python loop in a Lakeflow Spark Declarative Pipeline, or use a metadata-driven framework, instead of one custom engine.',
          ],
        ],
      },
      links: [
        { label: 'Manage data quality with pipeline expectations', url: 'https://docs.databricks.com/aws/en/ldp/expectations' },
        { label: 'AUTO CDC', url: 'https://docs.databricks.com/aws/en/ldp/cdc' },
        { label: 'Run a parameterized job task in a loop (for_each)', url: 'https://docs.databricks.com/aws/en/jobs/for-each' },
      ],
    },
    {
      id: 'config',
      heading: 'What belongs in configuration',
      points: [
        {
          strong: 'Per-source facts.',
          text: 'File format and options, landing path, column mapping to a canonical schema, business key, sequence column, and the quality rules that apply.',
        },
        {
          strong: 'Not logic.',
          text: 'If a config option needs an if-statement in shared code, it is a new adapter. Keep configuration declarative: names, expressions, and thresholds.',
        },
        {
          strong: 'Where it lives.',
          text: 'Keep it in Git when changes need review, a diff, and a deploy; this is the default. Use a Unity Catalog table when data owners edit it often without a deploy, and then add validation, an audit trail, and permissions yourself.',
        },
        {
          strong: 'Typed and validated.',
          text: 'Parse each config into a typed object, reject missing canonical columns and unknown rule types, and check configs in CI before they deploy.',
        },
        {
          strong: 'Idempotent by key.',
          text: 'Define the MERGE key (or AUTO CDC key) in config so a rerun or backfill updates rows instead of duplicating them.',
        },
        {
          strong: 'Drift handling is a choice per source.',
          text: 'Set Auto Loader schema evolution and a rescued data column per source, so new columns are captured without a code change and unexpected types do not fail the load.',
        },
      ],
    },
    {
      id: 'rules',
      heading: 'Rules, quarantine, and alerts',
      prose:
        'Validate every row against the rules in the config. Rows that pass go to the target. Rows that fail go to a quarantine table with the names of the rules they failed, so someone can repair and replay them. Alert on the reject rate, not on individual rows.',
      diagram: {
        type: 'flow',
        title: 'What happens to each row',
        description:
          'A landed file is read by the adapter and mapped to canonical columns. The shared rules are applied. Rows that pass every rule are merged into the target table. Rows that fail any rule go to the quarantine table with an array of failed rule names. The audit row records read, valid, and quarantined counts. A SQL alert reads the audit table on a schedule and notifies the owner when the quarantine rate is above a threshold.',
        nodes: [
          { id: 'file', label: 'Landed file', sub: 'CSV, JSON, or other', col: 0, row: 0, kind: 'store' },
          { id: 'adapter', label: 'Adapter', sub: 'map to canonical columns', col: 1, row: 0 },
          { id: 'rules', label: 'Shared rules', sub: 'from configuration', col: 2, row: 0, kind: 'highlight' },
          { id: 'gate', label: 'All rules pass?', col: 3, row: 0, kind: 'gate' },
          { id: 'target', label: 'Target table', sub: 'MERGE or AUTO CDC', col: 4, row: 0, kind: 'store' },
          { id: 'quarantine', label: 'Quarantine table', sub: 'failed rule names', col: 3, row: 1, kind: 'store' },
          { id: 'audit', label: 'Audit table', sub: 'read, valid, rejected', col: 2, row: 2, kind: 'store' },
          { id: 'alert', label: 'SQL alert', sub: 'reject rate threshold', col: 3, row: 2, kind: 'surface' },
          { id: 'owner', label: 'Owner notified', sub: 'email or webhook', col: 4, row: 2 },
        ],
        edges: [
          { from: 'file', to: 'adapter' },
          { from: 'adapter', to: 'rules' },
          { from: 'rules', to: 'gate' },
          { from: 'gate', to: 'target', label: 'pass' },
          { from: 'gate', to: 'quarantine', label: 'fail' },
          { from: 'rules', to: 'audit', label: 'counts' },
          { from: 'audit', to: 'alert' },
          { from: 'alert', to: 'owner' },
        ],
        legend: [
          { kind: 'highlight', label: 'Rules declared once' },
          { kind: 'gate', label: 'Row-level decision' },
          { kind: 'surface', label: 'Alert' },
        ],
        caption:
          'A feed error should fail the task so the job retry policy and failure notification apply, and still write an audit row.',
      },
    },
    {
      id: 'adapters',
      heading: 'Keep source quirks behind an adapter',
      prose:
        'Most sources need only mapping, which is configuration. A few need code, such as decoding a status code or parsing a proprietary layout. Give those one small function with a fixed contract: read the landed data, return a DataFrame in the canonical schema. Register it by name in the config. Shared code never branches on the source name.',
    },
    {
      id: 'audit',
      heading: 'Audit it from system tables',
      prose:
        'The framework writes its own audit table. Databricks system tables add who ran or changed the job and pipeline, what wrote each table, and which SQL read it.',
      steps: [
        {
          title: 'Runs and updates',
          body: 'system.lakeflow.job_run_timeline and system.lakeflow.pipeline_update_timeline show every run, its trigger, the identity it ran as, and the result. Tag jobs so queries find them in any workspace.',
        },
        {
          title: 'Who changed or started them',
          body: 'system.access.audit records create, edit, run, and permission changes for jobs and pipelines.',
          code: "SELECT event_time, user_identity.email AS actor, service_name, action_name\nFROM system.access.audit\nWHERE service_name IN ('jobs', 'deltaPipelines')\n  AND action_name IN ('create', 'edit', 'runNow', 'startUpdate', 'repairRun')\nORDER BY event_time DESC;",
        },
        {
          title: 'Lineage and query activity',
          body: 'system.access.table_lineage shows which job or pipeline wrote each table and from where. system.query.history shows SQL warehouse reads and writes.',
        },
      ],
    },
  ],
  related: [
    { slug: 'reusability-templatization', title: 'Reusable ingestion templates' },
    { slug: 'medallion-architecture', title: 'Medallion architecture' },
    { slug: 'dataops', title: 'Pipeline operations' },
  ],
};
