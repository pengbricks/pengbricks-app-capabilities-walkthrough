import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'versioning',
  area: 'CI/CD & Version Control Guides',
  title: 'Data contract versioning',
  intro:
    'A table schema is a contract with every reader. Databricks gives you the pieces to change it safely: Delta table features that evolve a schema in place, constraints that protect it, views that give readers a stable interface, Unity Catalog tags and lineage to run a deprecation, and OpenSharing for readers outside your workspace. This page shows which tool fits which change, and where a custom compatibility check in CI is worth adding.',
  businessValue: {
    summary:
      'Table changes stop breaking dashboards, models, and partner feeds. Data owners change schemas on a schedule readers know about and retire old tables without surprising anyone.',
    outcomes: [
      {
        title: 'Fewer broken downstream reports',
        body:
          'Readers query a view, so a producer can swap tables or rename columns behind it. The old shape stays alive until consumers move.',
      },
      {
        title: 'Bad data stopped at write time',
        body:
          'NOT NULL and CHECK constraints reject bad rows when they are written, so a producer cannot break the contract by accident.',
      },
      {
        title: 'Managed retirement',
        body:
          'Tag the old object as deprecated, find remaining readers with table lineage and query history, and drop it on the date you announced.',
      },
      {
        title: 'Governed sharing outside the workspace',
        body:
          'OpenSharing gives outside recipients a governed table or view. Check that their readers support the table features you enable before you share.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Evolve in place when readers are unaffected.',
      body: 'Adding a nullable column, widening a type, and renaming or dropping a column with column mapping are metadata-only changes. Delta handles them without rewriting data.',
    },
    {
      title: 'Guard the contract with constraints.',
      body: 'NOT NULL and CHECK constraints reject bad rows at write time, so a producer cannot break the contract by accident.',
    },
    {
      title: 'Give readers a view, not the table.',
      body: 'A view is the interface. Behind it you can swap tables, rename columns, and keep the old shape alive while readers move.',
    },
    {
      title: 'Run deprecation from the catalog.',
      body: 'Tag the old object as deprecated, find who still reads it with table lineage and query history, tell them, and drop it on the schedule you announced.',
    },
    {
      title: 'Share outside the workspace with OpenSharing.',
      body: 'Recipients get a governed copy of a table or view. Check that their readers support the table features you enable.',
    },
  ],
  sections: [
    {
      id: 'changes',
      heading: 'Which change needs which tool',
      prose:
        'Classify the change by what it does to a reader that has not changed. A reader that selects columns by name breaks when a column disappears or changes meaning, and survives when one is added.',
      diagram: {
        type: 'matrix',
        title: 'Change types and the platform feature for each',
        description:
          'Adding a nullable column is nonbreaking and uses schema evolution or ALTER TABLE ADD COLUMN. Widening a type is nonbreaking and uses Delta type widening. Renaming a column is breaking for readers and uses column mapping plus a compatibility view. Dropping a column is breaking and uses column mapping plus a deprecation period. Narrowing a type or changing what a value means is breaking and needs a new table version behind a view.',
        corner: 'Change ↓ · Result →',
        columns: ['For readers', 'Platform feature', 'Rollout'],
        rows: [
          {
            label: 'Add a nullable column',
            cells: [
              { state: 'own', text: 'Nonbreaking' },
              { state: 'own', text: 'Schema evolution, ADD COLUMN' },
              { state: 'own', text: 'In place' },
            ],
          },
          {
            label: 'Widen a type',
            sub: 'for example int to bigint',
            cells: [
              { state: 'own', text: 'Nonbreaking' },
              { state: 'own', text: 'Type widening' },
              { state: 'own', text: 'In place' },
            ],
          },
          {
            label: 'Rename a column',
            cells: [
              { state: 'none', text: 'Breaking' },
              { state: 'optional', text: 'Column mapping, view' },
              { state: 'optional', text: 'Old name via view' },
            ],
          },
          {
            label: 'Drop a column',
            cells: [
              { state: 'none', text: 'Breaking' },
              { state: 'optional', text: 'Column mapping' },
              { state: 'optional', text: 'Deprecate, then drop' },
            ],
          },
          {
            label: 'Narrow a type or change meaning',
            cells: [
              { state: 'none', text: 'Breaking' },
              { state: 'none', text: 'New table version' },
              { state: 'none', text: 'Behind a view' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Nonbreaking, in place' },
          { state: 'optional', label: 'Metadata-only, but readers notice' },
          { state: 'none', label: 'Needs a new version' },
        ],
        caption:
          'Tightening nullability and adding a NOT NULL column are also breaking for writers. A comment-only change is nonbreaking.',
      },
    },
    {
      id: 'evolve',
      heading: 'Evolve tables in place',
      prose:
        'Delta table features make common changes metadata-only. Enable them once per table, then run ordinary ALTER statements.',
      points: [
        {
          strong: 'Type widening.',
          text: 'Widen a column, such as int to bigint or float to double, without rewriting files. Enable the table property, then ALTER COLUMN TYPE. Streaming reads and Databricks-to-Databricks sharing work across a widened column. Change data feed reads need to be split at the type change.',
        },
        {
          strong: 'Column mapping.',
          text: 'Rename and drop columns as metadata-only changes. It also allows spaces and other characters in column names. A rename or drop can break streaming readers, so restart the stream or use schema tracking.',
        },
        {
          strong: 'Schema evolution modes.',
          text: 'Pick how new columns arrive instead of letting them surprise you. Auto Loader offers addNewColumns, rescue, failOnNewColumns, and none. MERGE and writes evolve with schema evolution turned on, and Lakeflow Spark Declarative Pipelines handle new columns in streaming tables.',
        },
        {
          strong: 'Prefer explicit over automatic in the gold layer.',
          text: 'Let bronze absorb new source columns with rescue or addNewColumns. Promote a column to silver and gold on purpose, through a reviewed change.',
        },
      ],
      examples: [
        {
          label: 'Widen a type, rename a column, drop a column',
          language: 'sql',
          code: `-- Widen in place
ALTER TABLE main.sales.customers SET TBLPROPERTIES ('delta.enableTypeWidening' = 'true');
ALTER TABLE main.sales.customers ALTER COLUMN lifetime_value TYPE BIGINT;

-- Rename and drop need column mapping
ALTER TABLE main.sales.customers SET TBLPROPERTIES (
  'delta.columnMapping.mode' = 'name',
  'delta.minReaderVersion' = '2',
  'delta.minWriterVersion' = '5');
ALTER TABLE main.sales.customers RENAME COLUMN full_name TO display_name;
ALTER TABLE main.sales.customers DROP COLUMN legacy_flag;`,
          notes: ['Column mapping raises the minimum reader version. Confirm every reader and sharing recipient supports it first.'],
        },
        {
          label: 'Choose how Auto Loader treats new columns',
          language: 'python',
          code: `(spark.readStream.format("cloudFiles")
  .option("cloudFiles.format", "json")
  .option("cloudFiles.schemaLocation", "/Volumes/main/raw/_schemas/customers")
  .option("cloudFiles.schemaEvolutionMode", "rescue")   # or addNewColumns, failOnNewColumns, none
  .load("/Volumes/main/raw/customers/"))`,
          notes: ['rescue keeps unexpected fields in _rescued_data, so nothing is lost and the schema does not move.'],
        },
      ],
      options: {
        caption: 'What Auto Loader does with a new column',
        rows: [
          {
            option: 'addNewColumns (default)',
            when: 'Bronze ingestion where new source fields should reach the table.',
            tradeoffs: 'The stream fails once with an UnknownFieldException after it adds the new columns, then resumes when restarted. Run it as a Lakeflow Job with automatic restart. Existing column types do not change.',
          },
          {
            option: 'rescue',
            when: 'The schema must stay put and nothing may be lost.',
            tradeoffs: 'The schema never evolves and the stream does not fail. New fields land in the rescued data column, and someone has to read it and promote columns on purpose.',
          },
          {
            option: 'failOnNewColumns',
            when: 'A strict contract where the producer must announce changes.',
            tradeoffs: 'No surprise columns. The stream stops and stays stopped until you update the schema or remove the offending file, so each upstream change pages someone.',
          },
          {
            option: 'none',
            when: 'Only a fixed set of columns matters.',
            tradeoffs: 'New columns are ignored and the stream never fails. Data is not rescued unless you set the rescued data column, so values can disappear without a signal.',
          },
        ],
        recommendation: 'Use rescue for bronze tables that feed a reviewed gold layer, and addNewColumns where the producer adds fields often and a job restarts the stream. Use none only with a rescued data column set.',
      },
      links: [
        {
          label: 'Delta type widening',
          url: 'https://docs.databricks.com/aws/en/tables/features/type-widening',
        },
        {
          label: 'Rename and drop columns with column mapping',
          url: 'https://docs.databricks.com/aws/en/tables/features/column-mapping',
        },
        {
          label: 'Update table schema',
          url: 'https://docs.databricks.com/aws/en/tables/update-schema',
          note: 'ALTER TABLE and schema evolution on writes.',
        },
        {
          label: 'Auto Loader schema evolution',
          url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/schema',
        },
      ],
    },
    {
      id: 'guard',
      heading: 'Enforce the contract at write time',
      prose:
        'A contract that is only documented gets broken. Constraints turn the rules into write-time checks, so a bad row fails the producer instead of surprising a reader.',
      points: [
        {
          strong: 'NOT NULL',
          text: 'for keys and columns every reader relies on. Loosening it later is nonbreaking. Tightening it is breaking.',
        },
        {
          strong: 'CHECK constraints',
          text: 'for value rules, such as ranges, allowed codes, and cross-column logic. A write that violates one fails the whole transaction.',
        },
        {
          strong: 'Expectations in pipelines.',
          text: 'In Lakeflow Spark Declarative Pipelines, expectations can drop or quarantine bad rows instead of failing, which fits ingestion layers.',
        },
      ],
      examples: [
        {
          label: 'Add constraints to a table',
          language: 'sql',
          code: `ALTER TABLE main.sales.customers ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE main.sales.customers
  ADD CONSTRAINT valid_tier CHECK (loyalty_tier IN ('bronze', 'silver', 'gold'));`,
          notes: ['Adding a constraint checks existing rows and fails if any violate it, so fix the data first.'],
        },
      ],
      options: {
        caption: 'Where to reject bad rows',
        rows: [
          {
            option: 'Table constraints (NOT NULL, CHECK)',
            when: 'Gold tables and any table whose readers rely on the rule.',
            tradeoffs: 'A write that violates a constraint fails the whole transaction, so bad rows never land. The producer job fails and someone fixes the data. Adding a constraint checks existing rows and fails if any violate it.',
          },
          {
            option: 'Pipeline expectation that drops rows',
            when: 'Ingestion layers where losing a few rows is acceptable and you want counts.',
            tradeoffs: 'Invalid records are dropped before they reach the target, and the pipeline UI shows how many. Dropped rows are gone from the table unless you capture them elsewhere.',
          },
          {
            option: 'Pipeline expectation that fails the update',
            when: 'Layers where one bad record means the data should not publish.',
            tradeoffs: 'Invalid records stop the update, and manual intervention is required before reprocessing. Nothing bad lands, and the pipeline is down until someone acts.',
          },
          {
            option: 'Quarantine pattern',
            when: 'You want good rows to flow and bad rows kept for review.',
            tradeoffs: 'Valid rows reach the target and invalid rows go to a side table, with no loss and no failure. It takes extra pipeline logic, and someone has to review the quarantine table.',
          },
        ],
        recommendation: 'Use constraints on gold tables, and expectations in ingestion pipelines with quarantine where bad rows need review. The default expectation action, warn, keeps invalid rows in the target.',
      },
      links: [
        {
          label: 'Constraints on Databricks',
          url: 'https://docs.databricks.com/aws/en/tables/constraints',
        },
        {
          label: 'Manage data quality with pipeline expectations',
          url: 'https://docs.databricks.com/aws/en/ldp/expectations',
          note: 'Warn, drop, and fail actions, and quarantine patterns.',
        },
      ],
    },
    {
      id: 'interface',
      heading: 'Give readers a view as the interface',
      prose:
        'Readers who query a view do not care which table sits under it. That lets you ship a breaking change as a new table version and keep the old column names working until readers move.',
      diagram: {
        type: 'flow',
        title: 'Readers on a stable view during a breaking change',
        description:
          'Dashboards, jobs, and external recipients read a stable view. During a breaking change the old view keeps the previous column names and selects from the new table version. A new view exposes the new names. The previous table stays as an archive until the sunset.',
        nodes: [
          { id: 'dash', label: 'Dashboards', sub: 'BI and Genie', col: 0, row: 0 },
          { id: 'jobs', label: 'Downstream jobs', sub: 'Lakeflow Jobs', col: 0, row: 1 },
          { id: 'ext', label: 'External recipients', sub: 'OpenSharing', col: 0, row: 2 },
          { id: 'old', label: 'Deprecated view', sub: 'old column names', col: 2, row: 0, kind: 'surface' },
          { id: 'new', label: 'Current view', sub: 'new column names', col: 2, row: 2, kind: 'highlight' },
          { id: 'tbl', label: 'Versioned table', sub: 'current schema', col: 4, row: 1, kind: 'store' },
          { id: 'arch', label: 'Archived table', sub: 'previous schema', col: 4, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'dash', to: 'old' },
          { from: 'jobs', to: 'old' },
          { from: 'ext', to: 'new' },
          { from: 'old', to: 'tbl', label: 'aliases old names' },
          { from: 'new', to: 'tbl' },
          { from: 'tbl', to: 'arch', dashed: true, label: 'kept until sunset' },
        ],
        legend: [
          { kind: 'surface', label: 'Deprecated, tagged' },
          { kind: 'highlight', label: 'Current interface' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
      points: [
        {
          strong: 'Expose views, keep tables private.',
          text: 'Grant readers SELECT on the views schema and keep the base tables in a schema only producers can read.',
        },
        {
          strong: 'Alias, cast, and default.',
          text: 'A compatibility view can rename columns back, cast a narrowed type to the old type, and supply a default for a new required column.',
        },
        {
          strong: 'Version the name only on a breaking change.',
          text: 'Nonbreaking changes keep the same object. A breaking one publishes a new versioned object and leaves the old interface in place as deprecated.',
        },
      ],
      options: {
        caption: 'How to ship a rename, a drop, or a change in meaning',
        rows: [
          {
            option: 'Add the new column, keep the old one, then drop later',
            when: 'A rename that can run in two steps, with a grace period for readers.',
            tradeoffs: 'Adding a nullable column is nonbreaking, so readers keep working while they move. Writers fill two columns for a while, and the copies can drift apart. You finish with a drop, which needs column mapping.',
          },
          {
            option: 'Column mapping in place',
            when: 'You know every reader and can update them together.',
            tradeoffs: 'A rename or drop is metadata only, with no files rewritten. It breaks queries that name the old column and can break streaming readers. It raises the minimum reader and writer protocol versions, so check every reader and share recipient first.',
          },
          {
            option: 'A new versioned table behind a compatibility view',
            when: 'Readers you cannot move on your schedule, external recipients, a narrowed type, or a change in meaning.',
            tradeoffs: 'Old names keep working through the view until the sunset date. You keep two tables for a while, need a backfill, and have to tag, announce, and retire the old view.',
          },
        ],
        recommendation: 'Add and deprecate first. Use column mapping when you control every reader, and use a versioned table behind a view when readers are outside your control or the meaning changes.',
      },
      links: [
        {
          label: 'Views',
          url: 'https://docs.databricks.com/aws/en/views',
        },
        {
          label: 'Rename and drop columns with column mapping',
          url: 'https://docs.databricks.com/aws/en/tables/features/column-mapping',
          note: 'Protocol requirements and limits.',
        },
      ],
    },
    {
      id: 'deprecate',
      heading: 'Deprecate with tags and find the consumers',
      prose:
        'Deprecation is a process with an owner and a date. Unity Catalog stores the markers, and its lineage and query history tell you who is still affected.',
      steps: [
        {
          title: 'Mark the old object',
          body: 'Set tags for the status, the replacement, and the sunset date, and put the migration target in the comment so it shows in Catalog Explorer.',
          code: `ALTER VIEW main.sales.customers_v1 SET TAGS ('deprecated' = 'true', 'sunset_date' = '<yyyy-mm-dd>', 'replaced_by' = 'main.sales.customers');
COMMENT ON VIEW main.sales.customers_v1 IS 'Deprecated. Use main.sales.customers.';`,
        },
        {
          title: 'Find consumers from lineage',
          body: 'Table lineage lists the jobs, notebooks, dashboards, and downstream tables that read an object. It reports the entities, so you can contact their owners.',
          code: `SELECT DISTINCT entity_type, entity_id, created_by, target_table_full_name
FROM system.access.table_lineage
WHERE source_table_full_name = 'main.sales.customers_v1'
  AND event_time >= current_date() - INTERVAL 90 DAYS;`,
        },
        {
          title: 'Find ad hoc readers from query history',
          body: 'Lineage names the jobs, notebooks, and dashboards that read an object. Query history adds the user and statement for ad hoc SQL warehouse queries that lineage does not attribute to a person.',
          code: `SELECT executed_by, count(*) AS queries, max(start_time) AS last_query
FROM system.query.history
WHERE statement_text ILIKE '%customers_v1%'
  AND start_time >= current_date() - INTERVAL 90 DAYS
GROUP BY executed_by
ORDER BY queries DESC;`,
        },
        {
          title: 'Notify, then enforce the date',
          body: 'Send each owner what changed, what to do, and the deadline. Re-run the lineage query before the sunset. When no reader is left, or the date passes, drop the object with a scheduled job.',
        },
      ],
      links: [
        {
          label: 'Tags in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/database-objects/tags',
        },
        {
          label: 'Lineage system tables',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/lineage',
        },
        {
          label: 'Query history system table',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/query-history',
        },
      ],
    },
    {
      id: 'share',
      heading: 'Version what you share outside',
      prose:
        'Readers outside your workspace are not visible in your lineage, so the contract matters more. OpenSharing gives them governed access to a table or view without a copy to maintain.',
      points: [
        {
          strong: 'Share the interface.',
          text: 'Add the stable view to the share, not the base table, so you can change what is under it.',
        },
        {
          strong: 'Check recipient support first.',
          text: 'Features such as column mapping and type widening raise reader requirements. Confirm that each recipient client supports them before you enable them on a shared table.',
        },
        {
          strong: 'Announce changes through the recipient list.',
          text: 'Recipients are named objects with owners. Use them as the notification list for a deprecation, and revoke access on the sunset date.',
        },
      ],
      links: [
        {
          label: 'OpenSharing',
          url: 'https://docs.databricks.com/aws/en/opensharing',
        },
      ],
    },
    {
      id: 'gate',
      heading: 'Optional: a compatibility gate in CI',
      prose:
        'If many teams publish tables, a check in CI can enforce that the version label matches the change. This is custom code. The platform does not require it, and the previous sections work without it.',
      diagram: {
        type: 'flow',
        title: 'A semantic-version check on a pull request',
        description:
          'A pull request changes a contract file. A check compares the old and new contract, classifies each change as breaking or nonbreaking, and compares the result to the version bump. A mismatch fails the check. A match lets the bundle deploy the change.',
        nodes: [
          { id: 'pr', label: 'Pull request', sub: 'contract file changed', col: 0, row: 0 },
          { id: 'diff', label: 'Diff the contracts', sub: 'old versus new', col: 1, row: 0 },
          { id: 'cls', label: 'Classify changes', sub: 'breaking or not', col: 2, row: 0, kind: 'highlight' },
          { id: 'bump', label: 'Bump matches?', sub: 'major or minor', col: 3, row: 0, kind: 'gate' },
          { id: 'ok', label: 'Deploy', sub: 'bundle deploy', col: 4, row: 0, kind: 'store' },
          { id: 'bad', label: 'Fail the check', sub: 'label the change', col: 3, row: 1, kind: 'surface' },
        ],
        edges: [
          { from: 'pr', to: 'diff' },
          { from: 'diff', to: 'cls' },
          { from: 'cls', to: 'bump' },
          { from: 'bump', to: 'ok', label: 'yes' },
          { from: 'bump', to: 'bad', label: 'no' },
        ],
        legend: [
          { kind: 'gate', label: 'Custom check' },
          { kind: 'surface', label: 'Merge blocked' },
        ],
        caption:
          'Rules to encode: a breaking change needs a major bump, a nonbreaking addition needs a minor bump, and a rename needs an explicit marker or it reads as a drop plus an add.',
      },
    },
  ],
  related: [
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'dataops', title: 'Pipeline operations' },
  ],
};
