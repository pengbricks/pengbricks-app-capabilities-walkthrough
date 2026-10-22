import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'configuration-vs-code',
  area: 'Ingestion',
  title: 'Metadata-driven ingestion',
  intro:
    'Metadata-driven ingestion describes each source in configuration and runs every source through one shared code path. Onboarding a source becomes a reviewed config change. This page covers what belongs in configuration, which platform features to use before you write a custom runner, and how to keep source quirks from spreading into shared code.',
  businessValue: {
    summary:
      'Describing each source in reviewed configuration lets teams add feeds without writing new pipeline code. Program owners get faster onboarding and a smaller code base to maintain.',
    outcomes: [
      {
        title: 'Onboarding is a config change',
        body: 'A new source is a configuration entry that goes through review, not a new engineering project. Time from request to data depends on the review.',
      },
      {
        title: 'Less code to own',
        body: 'Every source runs through one shared, tested code path. A fix or upgrade happens once instead of once per feed, which cuts maintenance and on-call load.',
      },
      {
        title: 'Bad data stops at the door',
        body: 'Each config is validated when it loads, and rows that fail a rule go to a quarantine table with the rule named. Reject-rate alerts warn owners early.',
      },
      {
        title: 'Change history on record',
        body: 'Configs live in Git, each run writes an audit record, and system tables show who changed or ran each job and pipeline.',
      },
    ],
  },
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
          {
            id: 'cfg',
            label: 'Source configs',
            sub: 'one file per source',
            col: 0,
            row: 0,
            kind: 'surface',
            icon: 'data-file',
            domain: 'orchestration',
            detail: 'One config file per source, stored in Git and deployed with the bundle.',
          },
          {
            id: 'schema',
            label: 'Typed config model',
            sub: 'validated at load',
            col: 1,
            row: 0,
            icon: 'data-model',
            domain: 'orchestration',
            detail: 'A typed model of the config that is validated when it loads, so a bad config fails early.',
          },
          {
            id: 'each',
            label: 'for_each task',
            sub: 'one run per source',
            col: 0,
            row: 1,
            icon: 'workflow',
            domain: 'orchestration',
            detail: 'A for-each task in the job that runs the shared ingestion task once per configured source.',
          },
          {
            id: 'run',
            label: 'Shared ingestion code',
            sub: 'same for every source',
            col: 1,
            row: 1,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'orchestration',
            detail:
              'The one ingestion task every source uses. It applies the source config and never branches on the source name.',
          },
          {
            id: 'target',
            label: 'Target table',
            sub: 'MERGE on the key',
            col: 0,
            row: 2,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'The standard output table. Valid rows are merged into it on the key.',
          },
          {
            id: 'quarantine',
            label: 'Quarantine table',
            sub: 'rows plus failed rules',
            col: 1,
            row: 2,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Rows that failed a rule, stored with the names of the rules they failed so someone can repair and replay them.',
          },
          {
            id: 'audit',
            label: 'Audit table',
            sub: 'one row per run',
            col: 2,
            row: 2,
            kind: 'store',
            icon: 'list',
            domain: 'governance',
            detail: 'One row per run, with counts of rows read, valid, and quarantined.',
          },
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
      options: {
        caption: 'Running the same logic for many sources',
        rows: [
          {
            option: 'for_each task in a Lakeflow Job',
            when: 'Each source is a separate unit of work that can succeed, fail, and be retried on its own, such as a file drop per partner.',
            tradeoffs:
              'Gives one child task per source with its own retries, run history, and repair run. Each iteration starts its own task, so many tiny sources add overhead, and tables are not tracked as one dependency graph.',
          },
          {
            option: 'Pipeline definitions generated from config',
            when: 'Sources land in tables that feed one another, and you want one dependency graph with lineage and incremental refresh.',
            tradeoffs:
              'A small Python loop creates a table or flow per source inside one Lakeflow Spark Declarative Pipeline, so Databricks handles checkpoints and ordering. A failure in one flow can affect the update, and adding a source means updating the pipeline.',
          },
          {
            option: 'A custom runner loop in one notebook or script',
            when: 'Sources must share one Spark session, or the logic has no fit with jobs or pipelines.',
            tradeoffs:
              'Most flexible, and you own everything else: retries, per-source status, state, and tests. A failure midway needs your own resume logic. Treat it as the last resort.',
          },
        ],
        recommendation:
          'Use a for_each task when sources are independent, and a generated pipeline when the outputs form a graph. Write a custom runner only when neither fits.',
      },
      links: [
        {
          label: 'Manage data quality with pipeline expectations',
          url: 'https://docs.databricks.com/aws/en/ldp/expectations',
        },
        { label: 'AUTO CDC', url: 'https://docs.databricks.com/aws/en/ldp/cdc' },
        {
          label: 'Run a parameterized job task in a loop (for_each)',
          url: 'https://docs.databricks.com/aws/en/jobs/for-each',
        },
        {
          label: 'Load and process data incrementally with flows',
          url: 'https://docs.databricks.com/aws/en/ldp/flows',
        },
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
      options: {
        caption: 'Choosing the home for configuration',
        rows: [
          {
            option: 'YAML or JSON files in Git, deployed with a bundle',
            when: 'Engineers own the configuration and every change needs review, a diff, and a controlled deploy.',
            tradeoffs:
              'Pull requests, CI validation, and rollback come with Git. A change needs a deploy, so data owners without Git access depend on engineers. Nothing extra to secure, since repo permissions apply.',
          },
          {
            option: 'A Unity Catalog table',
            when: 'Data owners or analysts edit settings often and a change should apply on the next run without a deploy.',
            tradeoffs:
              'Edits are quick and can use a form or dashboard, and Unity Catalog grants control who may write. You add the review process yourself: validation, an audit trail (Delta history helps), and a way to promote values between dev and prod. A bad row can break a live run.',
          },
          {
            option: 'Bundle variables or pipeline parameters',
            when: 'The settings are a handful of values per environment, such as catalog, schema, or a landing path.',
            tradeoffs:
              'The simplest option and fully versioned with the code. It does not scale to dozens of sources with column mappings and rules, where a structured file or table is easier to read and validate.',
          },
        ],
        recommendation:
          'Keep configuration in Git by default. Use a Unity Catalog table when non-engineers must change settings between deploys, and add validation and an audit trail when you do.',
      },
      links: [
        { label: 'Bundle variables', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/variables' },
        { label: 'Job parameters', url: 'https://docs.databricks.com/aws/en/jobs/parameters' },
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
          {
            id: 'file',
            label: 'Landed file',
            sub: 'CSV, JSON, or other',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'data-file',
            domain: 'data',
            detail: 'A landed file in a format such as CSV or JSON.',
          },
          {
            id: 'adapter',
            label: 'Adapter',
            sub: 'map to canonical columns',
            col: 1,
            row: 0,
            icon: 'gear-teal',
            domain: 'data',
            detail:
              'Reads the landed data and returns a DataFrame in the canonical schema. Most sources need only config mapping, and a few need a small function.',
          },
          {
            id: 'rules',
            label: 'Shared rules',
            sub: 'from configuration',
            col: 2,
            row: 0,
            kind: 'highlight',
            icon: 'checklist',
            domain: 'governance',
            detail: 'The validation rules, declared once in the config and applied the same way to every source.',
          },
          {
            id: 'gate',
            label: 'All rules pass?',
            col: 3,
            row: 0,
            kind: 'gate',
            domain: 'governance',
            detail:
              'A row-level decision. Rows that pass every rule go to the target, and rows that fail any rule go to quarantine.',
          },
          {
            id: 'target',
            label: 'Target table',
            sub: 'MERGE or AUTO CDC',
            col: 4,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'Rows that passed every rule are merged here with MERGE or AUTO CDC.',
          },
          {
            id: 'quarantine',
            label: 'Quarantine table',
            sub: 'failed rule names',
            col: 3,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'Rows that failed a rule, with an array of the failed rule names.',
          },
          {
            id: 'audit',
            label: 'Audit table',
            sub: 'read, valid, rejected',
            col: 2,
            row: 2,
            kind: 'store',
            icon: 'list',
            domain: 'governance',
            detail: 'Records read, valid, and rejected counts for each run. The alert reads this table.',
          },
          {
            id: 'alert',
            label: 'SQL alert',
            sub: 'reject rate threshold',
            col: 3,
            row: 2,
            kind: 'surface',
            domain: 'apps',
            detail:
              'A SQL alert that reads the audit table on a schedule and fires when the quarantine rate is above a threshold.',
          },
          {
            id: 'owner',
            label: 'Owner notified',
            sub: 'email or webhook',
            col: 4,
            row: 2,
            icon: 'users',
            domain: 'neutral',
            detail: 'The owner is told by email or webhook. The alert watches the reject rate, not individual rows.',
          },
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
