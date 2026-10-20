import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-ingestion-feature-preparation',
  area: 'Ingestion',
  title: 'Feature preparation from source data',
  intro:
    'Real invoice lines from a UK online retailer become a customer feature table in Unity Catalog, pass 18 quality checks, and are frozen as a training set tied to exact Delta versions. Unity Catalog lineage then shows the training set back through three hops to the raw invoice lines.',
  shortVersion: [
    {
      title: 'The source is a public dataset.',
      body: 'land_source downloads UCI Online Retail II (CC BY 4.0), checks its pinned SHA-256, and writes all 1,067,371 invoice lines. 243,007 have no customer ID and stay out of the snapshot. The rest become 3,321 customers as of 2010-09-01.',
    },
    {
      title: 'Features live in a governed table.',
      body: 'The Feature Engineering client creates customer_features with customer_id as the primary key.',
    },
    {
      title: 'Eighteen checks gate the job.',
      body: 'Key, null, and range checks write to feature_quality_results. Any failure fails the task before a training set exists. All 18 passed with zero violations.',
    },
    {
      title: 'The training set is versioned.',
      body: 'training_set_v<N> is a snapshot of the feature table at Delta version N joined to labels at a recorded source version. The reference run wrote training_set_v2 with 3,321 rows.',
    },
    {
      title: 'Lineage is read back.',
      body: 'The last task asks Unity Catalog for the upstream tables and records what it found: ml_retail_transactions, customer_activity_raw, customer_features, then training_set_v2.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From source rows to a training set',
      prose:
        'Four tasks run in order. Each passes the Delta versions it used to the next, so the training set can name its inputs. The first task lands the raw invoice lines and the customer snapshot with its churn label.',
      diagram: {
        type: 'flow',
        title: 'Feature preparation job',
        description:
          'land_source downloads and verifies the public dataset, then writes ml_retail_transactions (every invoice line) and customer_activity_raw (one row per customer, with the churn label). build_features derives features, creates customer_features, and writes quality results. snapshot_training_set joins the feature table at a Delta version with labels from the source and writes training_set_vN and a version registry row. record_lineage reads Unity Catalog lineage and writes feature_lineage.',
        lanes: [
          { label: 'Lakeflow job', fromRow: 0, toRow: 0 },
          { label: 'Unity Catalog tables', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'gen', label: 'land_source', mono: true, sub: 'download, verify, load', col: 0, row: 0 },
          {
            id: 'feat',
            label: 'build_features',
            mono: true,
            sub: 'derive and check',
            col: 1,
            row: 0,
            kind: 'highlight',
          },
          { id: 'snap', label: 'snapshot_training_set', mono: true, sub: 'join at Delta versions', col: 2, row: 0 },
          { id: 'lin', label: 'record_lineage', mono: true, sub: 'lineage API', col: 3, row: 0 },
          {
            id: 'raw',
            label: 'customer_activity_raw',
            mono: true,
            sub: 'one row per customer',
            col: 0,
            row: 1,
            kind: 'store',
          },
          {
            id: 'tx',
            label: 'ml_retail_transactions',
            mono: true,
            sub: 'every invoice line',
            col: 0,
            row: 2,
            kind: 'store',
          },
          { id: 'ft', label: 'customer_features', mono: true, sub: 'primary key', col: 1, row: 1, kind: 'store' },
          { id: 'ts', label: 'training_set_vN', mono: true, col: 2, row: 1, kind: 'store' },
          { id: 'fl', label: 'feature_lineage', mono: true, col: 3, row: 1, kind: 'store' },
          { id: 'q', label: 'feature_quality_results', mono: true, col: 1, row: 2, kind: 'store' },
          { id: 'reg', label: 'training_set_versions', mono: true, col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'gen', to: 'feat' },
          { from: 'feat', to: 'snap', label: 'versions' },
          { from: 'snap', to: 'lin' },
          { from: 'gen', to: 'raw' },
          { from: 'gen', to: 'tx' },
          { from: 'feat', to: 'ft' },
          { from: 'feat', to: 'q' },
          { from: 'snap', to: 'ts' },
          { from: 'snap', to: 'reg' },
          { from: 'lin', to: 'fl' },
        ],
        legend: [
          { kind: 'highlight', label: 'Creates the feature table and runs checks' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'quality',
      heading: 'What the checks cover',
      prose:
        'The checks are SQL built from the spec, one per column rule. Each returns a count of violating rows, and zero passes. The data is real, so it is messy. Credit notes (invoice numbers starting with C) count as returns. Customers with one order have no gap between orders, so days_between_orders is null for 1,284 of 3,321 customers (38.7%). order_gap_days fills that null with days_since_purchase, and single_order flags the customers it filled, so the not-null check on order_gap_days passes.',
      diagram: {
        type: 'matrix',
        title: 'Quality checks in the reference run',
        description:
          'The key is checked for nulls and duplicates. Ten feature columns are checked for nulls. Six columns have inclusive range checks. All 18 checks passed with zero violating rows.',
        corner: 'Check type ↓',
        columns: ['Checks', 'Violations'],
        rows: [
          {
            label: 'Key',
            sub: 'customer_id',
            cells: [
              { state: 'own', text: '2 checks', sub: 'not null, unique' },
              { state: 'none', text: '0 rows' },
            ],
          },
          {
            label: 'Not null',
            sub: 'every feature column',
            cells: [
              { state: 'own', text: '10 checks' },
              { state: 'none', text: '0 rows' },
            ],
          },
          {
            label: 'Range',
            sub: 'inclusive min and max',
            cells: [
              { state: 'own', text: '6 checks' },
              { state: 'none', text: '0 rows' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Checks run' },
          { state: 'none', label: 'No violations' },
        ],
        caption: 'A violation fails build_features, so no training set is written from a failing table.',
      },
    },
    {
      id: 'version',
      heading: 'Versioned training input and lineage',
      prose:
        'The training set records the Delta version of the feature table and of the source it joined. In the reference run, training_set_v2 holds 3,321 rows from customer_features version 2 and customer_activity_raw version 8. Any later run can read the same rows with VERSION AS OF. The snapshot row count must equal the feature table row count at that version, or the task fails.',
      diagram: {
        type: 'flow',
        title: 'How a training set points back to its inputs',
        description:
          'customer_activity_raw at a source version supplies labels. customer_features at a feature table version supplies features. snapshot_training_set joins them into training_set_vN. A row in training_set_versions names both versions. Unity Catalog lineage walks back from training_set_vN to customer_features, to customer_activity_raw, to ml_retail_transactions.',
        nodes: [
          {
            id: 'raw',
            label: 'customer_activity_raw',
            mono: true,
            sub: 'labels at source version',
            col: 0,
            row: 0,
            kind: 'store',
          },
          {
            id: 'ft',
            label: 'customer_features',
            mono: true,
            sub: 'features at version N',
            col: 0,
            row: 1,
            kind: 'store',
          },
          { id: 'join', label: 'Join on customer_id', sub: 'VERSION AS OF', col: 1, row: 0, kind: 'highlight' },
          { id: 'ts', label: 'training_set_vN', mono: true, col: 2, row: 0, kind: 'store' },
          {
            id: 'reg',
            label: 'training_set_versions',
            mono: true,
            sub: 'both versions recorded',
            col: 2,
            row: 1,
            kind: 'store',
          },
          {
            id: 'tx',
            label: 'ml_retail_transactions',
            mono: true,
            sub: 'raw invoice lines',
            col: 0,
            row: 2,
            kind: 'store',
          },
          { id: 'lin', label: 'Lineage tab', sub: 'upstream tables', col: 3, row: 0, kind: 'surface' },
        ],
        edges: [
          { from: 'tx', to: 'raw', dashed: true, label: 'hop 1' },
          { from: 'raw', to: 'join' },
          { from: 'ft', to: 'join' },
          { from: 'join', to: 'ts' },
          { from: 'join', to: 'reg' },
          { from: 'ts', to: 'lin', dashed: true, label: 'read back' },
        ],
        legend: [
          { kind: 'highlight', label: 'Time-travel join' },
          { kind: 'surface', label: 'Unity Catalog lineage' },
        ],
        caption:
          'The lineage API found all three hops in the reference run. The task polls for up to five minutes and records what it finds.',
      },
    },
    {
      id: 'reproduce',
      heading: 'Check it yourself',
      steps: [
        {
          title: 'Read the registry',
          body: 'training_set_versions names the snapshot, the feature table version, and the source table version.',
          code: 'SELECT * FROM training_set_versions ORDER BY created_at DESC;',
        },
        {
          title: 'Rebuild the input from the versions',
          body: 'Time travel returns the same feature rows even after the table changes.',
          code: 'SELECT count(*) FROM customer_features VERSION AS OF <feature_table_version>;',
        },
        {
          title: 'Open lineage',
          body: 'On training_set_vN in Catalog Explorer, the Lineage tab lists customer_features upstream, and customer_activity_raw and ml_retail_transactions behind it. feature_lineage holds the same three hops.',
        },
      ],
    },
  ],
  related: [
    { slug: 'model-training-compatibility', title: 'Training and bringing existing models' },
    { slug: 'experiment-tracking', title: 'Reproducible experiments' },
  ],
};
