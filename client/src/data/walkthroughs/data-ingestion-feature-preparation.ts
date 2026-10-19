import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-ingestion-feature-preparation',
  area: 'Ingestion',
  title: 'Feature preparation from source data',
  intro:
    'A generated source table becomes a feature table in Unity Catalog, passes 16 quality checks, and is frozen as a training set tied to exact Delta versions. Unity Catalog lineage then shows the training set back to the source.',
  shortVersion: [
    {
      title: 'The source comes from a spec.',
      body: 'The generator builds 20,000 sample rows from use_cases/general.yml with a fixed seed. About 2% of usage_score is null on purpose.',
    },
    {
      title: 'Features live in a governed table.',
      body: 'The Feature Engineering client creates customer_features with customer_id as the primary key.',
    },
    {
      title: 'Sixteen checks gate the job.',
      body: 'Key, null, and range checks write to feature_quality_results. Any failure fails the task before a training set exists.',
    },
    {
      title: 'The training set is versioned.',
      body: 'training_set_v<N> is a snapshot of the feature table at Delta version N joined to labels at a recorded source version.',
    },
    {
      title: 'Lineage is read back.',
      body: 'The last task asks Unity Catalog for the upstream tables and records what it found.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From source rows to a training set',
      prose:
        'Four tasks run in order. Each passes the Delta versions it used to the next, so the training set can name its inputs.',
      diagram: {
        type: 'flow',
        title: 'Feature preparation job',
        description:
          'The use-case spec drives generate_source, which writes customer_activity_raw. build_features derives features, creates customer_features, and writes quality results. snapshot_training_set joins the feature table at a Delta version with labels from the source and writes training_set_vN and a version registry row. record_lineage reads Unity Catalog lineage and writes feature_lineage.',
        lanes: [
          { label: 'Lakeflow job', fromRow: 0, toRow: 0 },
          { label: 'Unity Catalog tables', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'gen', label: 'generate_source', mono: true, sub: 'generated data, fixed seed', col: 0, row: 0 },
          { id: 'feat', label: 'build_features', mono: true, sub: 'derive and check', col: 1, row: 0, kind: 'highlight' },
          { id: 'snap', label: 'snapshot_training_set', mono: true, sub: 'join at Delta versions', col: 2, row: 0 },
          { id: 'lin', label: 'record_lineage', mono: true, sub: 'lineage API', col: 3, row: 0 },
          { id: 'raw', label: 'customer_activity_raw', mono: true, col: 0, row: 1, kind: 'store' },
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
        'The checks are SQL generated from the spec, one per column rule. Each returns a count of violating rows, and zero passes. The null usage_score values are filled with 50 and flagged in usage_score_missing, so the not-null check on the filled column passes.',
      diagram: {
        type: 'matrix',
        title: 'Quality checks in the reference run',
        description:
          'The key is checked for nulls and duplicates. Nine feature columns are checked for nulls. Five columns have inclusive range checks. All 16 checks passed with zero violating rows.',
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
              { state: 'own', text: '9 checks' },
              { state: 'none', text: '0 rows' },
            ],
          },
          {
            label: 'Range',
            sub: 'inclusive min and max',
            cells: [
              { state: 'own', text: '5 checks' },
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
        'The training set records the Delta version of the feature table and of the source it joined. Any later run can read the same rows with VERSION AS OF. The snapshot row count must equal the feature table row count at that version, or the task fails.',
      diagram: {
        type: 'flow',
        title: 'How a training set points back to its inputs',
        description:
          'customer_activity_raw at a source version supplies labels. customer_features at a feature table version supplies features. snapshot_training_set joins them into training_set_vN. A row in training_set_versions names both versions. Unity Catalog lineage shows customer_features and customer_activity_raw upstream of training_set_vN.',
        nodes: [
          { id: 'raw', label: 'customer_activity_raw', mono: true, sub: 'labels at source version', col: 0, row: 0, kind: 'store' },
          { id: 'ft', label: 'customer_features', mono: true, sub: 'features at version N', col: 0, row: 1, kind: 'store' },
          { id: 'join', label: 'Join on customer_id', sub: 'VERSION AS OF', col: 1, row: 0, kind: 'highlight' },
          { id: 'ts', label: 'training_set_vN', mono: true, col: 2, row: 0, kind: 'store' },
          { id: 'reg', label: 'training_set_versions', mono: true, sub: 'both versions recorded', col: 2, row: 1, kind: 'store' },
          { id: 'lin', label: 'Lineage tab', sub: 'upstream tables', col: 3, row: 0, kind: 'surface' },
        ],
        edges: [
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
          'In the reference run lineage appeared about a minute after the writes. The task polls for up to five minutes and records what it finds.',
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
          body: 'On training_set_vN in Catalog Explorer, the Lineage tab lists customer_features and customer_activity_raw upstream. feature_lineage holds the same answer.',
        },
      ],
    },
  ],
  related: [
    { slug: 'model-training-compatibility', title: 'Training and bringing existing models' },
    { slug: 'experiment-tracking', title: 'Reproducible experiments' },
  ],
};
