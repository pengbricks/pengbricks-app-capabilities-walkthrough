import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'versioning',
  area: 'CI/CD & Version Control Guides',
  title: 'Data contract versioning',
  intro:
    'The release job treats the customers schema as a versioned contract. A nonbreaking change (v1.1.0) alters the table in place. A breaking change (v2.0.0) becomes a new table, and the old name stays alive as a deprecated view until 2027-03-31. A gate fails the job when the semantic version bump does not match the change.',
  shortVersion: [
    {
      title: 'The contract is a YAML file per version.',
      body: 'contracts/customers holds v1.0.0, v1.1.0, and v2.0.0 with columns, types, nullability, and renamed_from.',
    },
    {
      title: 'A gate checks the bump.',
      body: 'compatibility.py classifies each change as breaking or nonbreaking and requires a major, minor, or patch bump to match.',
    },
    {
      title: 'Nonbreaking changes alter in place.',
      body: 'v1.1.0 adds a nullable loyalty_tier with ALTER TABLE ADD COLUMN. The table is never recreated.',
    },
    {
      title: 'Breaking changes get a new table.',
      body: 'v2.0.0 publishes customers_v2. customers_v1 becomes a view with the old column names, tagged deprecated.',
    },
    {
      title: 'Every release leaves a record.',
      body: 'contract_registry, Delta history, Unity Catalog tags, and consumer_notifications show what changed, when, and who must act.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'The release flow',
      prose:
        'One serverless job runs six tasks in order. The gate runs before any table changes, so a mislabeled contract stops the job with the data untouched.',
      diagram: {
        type: 'flow',
        title: 'From contract files to notified consumers',
        description:
          'generate_data seeds sample rows. The compatibility_gate task reads the contract files and classifies changes and checks the semantic version. apply_v1 creates v1.0.0 and alters it to v1.1.0. apply_v2 publishes customers_v2 and the customers_v1 view. Both apply tasks write rows to contract_registry. show_traceability prints Delta history and tags. notify_consumers writes one row per consumer to consumer_notifications.',
        nodes: [
          { id: 'gen', label: 'generate_data', sub: 'generated data, fixed seed', mono: true, col: 0, row: 0 },
          { id: 'gate', label: 'compatibility_gate', sub: 'classify and check semver', mono: true, col: 1, row: 0, kind: 'highlight' },
          { id: 'v1', label: 'apply_v1', sub: 'v1.0.0, ALTER to v1.1.0', mono: true, col: 2, row: 0 },
          { id: 'v2', label: 'apply_v2', sub: 'customers_v2 plus view', mono: true, col: 3, row: 0 },
          { id: 'trace', label: 'show_traceability', sub: 'history and tags', mono: true, col: 4, row: 0 },
          { id: 'contracts', label: 'contracts/customers', sub: 'v1.0.0, v1.1.0, v2.0.0', col: 1, row: 1, kind: 'surface' },
          { id: 'reg', label: 'contract_registry', mono: true, sub: 'version, type, tag', col: 3, row: 1, kind: 'store' },
          { id: 'notify', label: 'notify_consumers', mono: true, sub: 'one row per consumer', col: 4, row: 1 },
          { id: 'cn', label: 'consumer_notifications', mono: true, col: 4, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'gen', to: 'gate' },
          { from: 'contracts', to: 'gate' },
          { from: 'gate', to: 'v1', label: 'pass' },
          { from: 'v1', to: 'v2' },
          { from: 'v2', to: 'trace' },
          { from: 'trace', to: 'notify' },
          { from: 'v2', to: 'reg' },
          { from: 'v1', to: 'reg' },
          { from: 'notify', to: 'cn' },
        ],
        legend: [
          { kind: 'highlight', label: 'Blocks the release on a mislabeled bump' },
          { kind: 'surface', label: 'Contract files in Git' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
        caption: 'The job also sends its on_success email. Sunset is recorded as a tag, not enforced by a scheduled drop.',
      },
    },
    {
      id: 'changes',
      heading: 'What counts as breaking',
      prose:
        'compatibility.py compares two contracts column by column. A change that can break a reader needs a major bump. A change readers can ignore needs a minor bump. No schema change needs a patch.',
      diagram: {
        type: 'matrix',
        title: 'Change types, classification, and required bump',
        description:
          'Adding a nullable column is nonbreaking and needs a minor bump. Widening a type, such as int to bigint, is nonbreaking and needs a minor bump. Renaming a column is breaking and needs a major bump. Narrowing a type is breaking and needs a major bump. Dropping a column is breaking and needs a major bump.',
        corner: 'Change ↓ · Result →',
        columns: ['Classification', 'Required bump', 'In this guide'],
        rows: [
          {
            label: 'Add a nullable column',
            cells: [
              { state: 'own', text: 'Nonbreaking' },
              { state: 'own', text: 'Minor' },
              { state: 'own', text: 'v1.1.0', sub: 'loyalty_tier' },
            ],
          },
          {
            label: 'Widen a type',
            sub: 'for example int to bigint',
            cells: [
              { state: 'own', text: 'Nonbreaking' },
              { state: 'own', text: 'Minor' },
              { state: 'none', text: 'Unit tests only' },
            ],
          },
          {
            label: 'Rename a column',
            sub: 'needs renamed_from',
            cells: [
              { state: 'none', text: 'Breaking' },
              { state: 'none', text: 'Major' },
              { state: 'none', text: 'v2.0.0', sub: 'full_name to display_name' },
            ],
          },
          {
            label: 'Narrow a type',
            cells: [
              { state: 'none', text: 'Breaking' },
              { state: 'none', text: 'Major' },
              { state: 'none', text: 'v2.0.0', sub: 'bigint to decimal(18,2)' },
            ],
          },
          {
            label: 'Drop a column',
            cells: [
              { state: 'none', text: 'Breaking' },
              { state: 'none', text: 'Major' },
              { state: 'none', text: 'Unit tests only' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Nonbreaking, minor bump' },
          { state: 'none', label: 'Breaking, major bump, or not exercised in the job' },
        ],
        caption:
          'Also nonbreaking: a new or changed comment and relaxed nullability. Also breaking: tightened nullability and a new NOT NULL column. Without renamed_from, a rename reads as a drop plus an add.',
      },
    },
    {
      id: 'v2',
      heading: 'The v1 to v2 consumer path',
      prose:
        'v2.0.0 renames two columns and narrows lifetime_value from bigint to decimal(18,2). apply_v2 writes the data to customers_v2 and rebuilds customers_v1 as a view that selects v2 data under the v1.1.0 column names. Existing readers keep working until the sunset date.',
      diagram: {
        type: 'flow',
        title: 'Consumers during the deprecation window',
        description:
          'Three consumers, finance-reporting, marketing-campaigns, and support-portal, read the customers_v1 compatibility view. The view selects from customers_v2 with the old column names. customers_v2 sits beside customers_v1_archive, which holds the deprecated physical v1.1.0 data. Only finance-reporting uses columns that changed.',
        nodes: [
          { id: 'fin', label: 'finance-reporting', sub: 'reads renamed columns', col: 0, row: 0 },
          { id: 'mkt', label: 'marketing-campaigns', sub: 'no changed columns', col: 0, row: 1 },
          { id: 'sup', label: 'support-portal', sub: 'no changed columns', col: 0, row: 2 },
          { id: 'view', label: 'customers_v1', sub: 'view, deprecated=true', mono: true, col: 2, row: 1, kind: 'surface' },
          { id: 'v2', label: 'customers_v2', sub: 'contract_version 2.0.0', mono: true, col: 4, row: 1, kind: 'highlight' },
          { id: 'arch', label: 'customers_v1_archive', sub: 'old v1.1.0 data', mono: true, col: 4, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'fin', to: 'view' },
          { from: 'mkt', to: 'view' },
          { from: 'sup', to: 'view' },
          { from: 'view', to: 'v2', label: 'old names over new data' },
          { from: 'v2', to: 'arch', dashed: true, label: 'kept, deprecated' },
        ],
        legend: [
          { kind: 'surface', label: 'Deprecated compatibility view' },
          { kind: 'highlight', label: 'Current contract' },
          { kind: 'store', label: 'Archived data' },
        ],
      },
      points: [
        {
          strong: 'Deprecation tags.',
          text: 'customers_v1 and customers_v1_archive carry contract_version 1.1.0, deprecated true, and sunset_date 2027-03-31. A COMMENT names customers_v2 as the migration target. customers_v2 is tagged contract_version 2.0.0 and deprecated false.',
        },
        {
          strong: 'Who must act.',
          text: 'Only finance-reporting reads changed columns. Its notification row says to move reads to customers_v2 and update full_name and lifetime_value before the sunset date. The other two consumers get an optional move.',
        },
        {
          strong: 'Sunset is recorded.',
          text: 'Nothing drops customers_v1 on 2027-03-31 yet. A scheduled job that does is the next step. Lineage on the view shows who still reads the old name.',
        },
      ],
    },
    {
      id: 'gate',
      heading: 'The gate rejects a mislabeled release',
      prose:
        'The gate runs over all published contract versions. It then repeats the v2 change under the label 1.2.0 as a dry run. The change renames columns, so it needs a major bump, and a minor bump fails. The job log prints the DRY RUN line with REJECTED. Unit tests in tests/test_compatibility.py cover the same case.',
      diagram: {
        type: 'flow',
        title: 'Same change, two labels',
        description:
          'The contract change from v1.1.0 to v2.0.0 renames columns and narrows a type, so diff_contracts classifies it as breaking and the required bump is major. Labeled 2.0.0, the gate accepts it and the job applies it. Labeled 1.2.0, the gate rejects it with an error and no table changes.',
        nodes: [
          { id: 'change', label: 'v1.1.0 to v2 change', sub: 'renames, narrows type', col: 0, row: 0 },
          { id: 'diff', label: 'diff_contracts', sub: 'classify each change', mono: true, col: 1, row: 0 },
          { id: 'req', label: 'Required bump: major', sub: 'any breaking change', col: 2, row: 0, kind: 'highlight' },
          { id: 'match', label: 'Label matches?', col: 3, row: 0, kind: 'gate' },
          { id: 'ok', label: 'Accept 2.0.0', sub: 'apply_v2 runs', col: 4, row: 0, kind: 'store' },
          { id: 'bad', label: 'Reject 1.2.0', sub: 'DRY RUN ... REJECTED', col: 3, row: 1, kind: 'surface' },
        ],
        edges: [
          { from: 'change', to: 'diff' },
          { from: 'diff', to: 'req' },
          { from: 'req', to: 'match' },
          { from: 'match', to: 'ok', label: '2.0.0' },
          { from: 'match', to: 'bad', label: '1.2.0' },
        ],
        legend: [
          { kind: 'gate', label: 'Version check' },
          { kind: 'surface', label: 'Rejected, no table touched' },
        ],
      },
    },
    {
      id: 'trace',
      heading: 'Tracing a release afterward',
      steps: [
        {
          title: 'Registry',
          body: 'One row per applied version: dataset, version, change type, release tag, applied time, and Delta table version.',
          code: 'SELECT * FROM <catalog>.<schema>.contract_registry ORDER BY applied_at;',
        },
        {
          title: 'Delta history and tags',
          body: 'show_traceability prints DESCRIBE HISTORY and the tag listing in the task log. Catalog Explorer shows the deprecation comment and tags on customers_v1.',
        },
        {
          title: 'Consumer notifications',
          body: 'One row per consumer in the use-case spec, with message, action required, and deadline.',
          code: 'SELECT consumer, impacted_columns, action_required, deadline\nFROM <catalog>.<schema>.consumer_notifications;',
        },
      ],
    },
  ],
  related: [
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'dataops', title: 'Pipeline operations' },
  ],
};
