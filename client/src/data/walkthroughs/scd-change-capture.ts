import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'scd-change-capture',
  area: 'Data Engineering Guides',
  title: 'SCD and change capture',
  intro:
    'One change feed drives two streaming tables with AUTO CDC. SCD type 1 keeps the latest row per key. SCD type 2 keeps every version. The job runs the pipeline on an initial snapshot, appends a change batch, runs it again without a full refresh, and records counts after each run.',
  shortVersion: [
    {
      title: 'One feed, two tables.',
      body: 'Both flows read accounts_changes with the same key, delete rule, and sequence. Only STORED AS differs.',
    },
    {
      title: 'Updates overwrite or add a version.',
      body: 'After 150 updates, type 1 still has one row per key. Type 2 has 150 keys with two versions.',
    },
    {
      title: 'Deletes are applied.',
      body: '40 deleted keys are gone from type 1. In type 2 their last version is closed with an end date.',
    },
    {
      title: 'The second run is incremental.',
      body: 'The pipeline_changes task runs with full_refresh false and processes only the new feed rows.',
    },
    {
      title: 'Counts are recorded.',
      body: 'scd_run_counts holds current rows, history rows, and deleted keys before and after the change batch.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Two pipeline runs on one feed',
      prose:
        'The feed is an append-only Delta table. Sequence 1 is the initial snapshot. Sequence 2 is the change batch of inserts, updates, and deletes.',
      diagram: {
        type: 'flow',
        title: 'Initial run, then change run',
        description:
          'prepare_initial writes the snapshot to accounts_changes. pipeline_initial runs with a full refresh and builds accounts_scd1 and accounts_scd2. counts_before records counts. prepare_changes appends the change batch. pipeline_changes runs incrementally. counts_after records counts.',
        lanes: [
          { label: 'Initial snapshot', fromRow: 0, toRow: 0 },
          { label: 'Change batch', fromRow: 1, toRow: 1 },
          { label: 'Unity Catalog tables', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'pi', label: 'prepare_initial', mono: true, sub: 'change_seq 1', col: 0, row: 0 },
          { id: 'p1', label: 'pipeline_initial', mono: true, sub: 'full refresh', col: 1, row: 0, kind: 'highlight' },
          { id: 'cb', label: 'counts_before', mono: true, sub: 'record_scd_counts', col: 2, row: 0 },
          { id: 'pc', label: 'prepare_changes', mono: true, sub: 'change_seq 2', col: 0, row: 1 },
          { id: 'p2', label: 'pipeline_changes', mono: true, sub: 'incremental', col: 1, row: 1, kind: 'highlight' },
          { id: 'ca', label: 'counts_after', mono: true, sub: 'record_scd_counts', col: 2, row: 1 },
          { id: 'feed', label: 'accounts_changes', mono: true, sub: 'append-only feed', col: 0, row: 2, kind: 'store' },
          { id: 'scd', label: 'accounts_scd1 / scd2', mono: true, sub: 'streaming tables', col: 1, row: 2, kind: 'store' },
          { id: 'cnt', label: 'scd_run_counts', mono: true, sub: 'before and after', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'pi', to: 'p1' },
          { from: 'p1', to: 'cb' },
          { from: 'cb', to: 'pc' },
          { from: 'pc', to: 'p2' },
          { from: 'p2', to: 'ca' },
          { from: 'pi', to: 'feed' },
          { from: 'feed', to: 'scd', label: 'AUTO CDC' },
          { from: 'ca', to: 'cnt' },
        ],
        legend: [
          { kind: 'highlight', label: 'Pipeline update' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'types',
      heading: 'How each change lands',
      prose: 'The same three change types produce different results in each table.',
      diagram: {
        type: 'matrix',
        title: 'Change type by table',
        description:
          'An insert adds a row to both tables. An update overwrites the row in type 1 and closes the current version and adds a new one in type 2. A delete removes the row in type 1 and closes the current version in type 2 with no new row.',
        corner: 'Change ↓ · Table →',
        columns: ['accounts_scd1', 'accounts_scd2'],
        rows: [
          {
            label: 'INSERT',
            sub: '60 keys',
            cells: [{ state: 'own', text: 'new row' }, { state: 'own', text: 'new current row' }],
          },
          {
            label: 'UPDATE',
            sub: '150 keys',
            cells: [{ state: 'own', text: 'row overwritten' }, { state: 'own', text: 'old closed, new added' }],
          },
          {
            label: 'DELETE',
            sub: '40 keys',
            cells: [{ state: 'own', text: 'row removed' }, { state: 'own', text: 'current row closed' }],
          },
        ],
        legend: [{ state: 'own', label: 'Result in this table' }],
      },
      examples: [
        {
          label: "Type 2 history on selected columns only",
          language: 'sql',
          code: "CREATE FLOW accounts_scd2_flow AS AUTO CDC INTO accounts_scd2\nFROM STREAM(accounts_changes)\nKEYS (account_id)\nAPPLY AS DELETE WHEN change_type = 'DELETE'\nSEQUENCE BY change_seq\nCOLUMNS * EXCEPT (change_type, change_seq)\nSTORED AS SCD TYPE 2\nTRACK HISTORY ON * EXCEPT (last_login_at);",
          notes: ["Changes to last_login_at overwrite the current row instead of adding a history row."],
        },
      ],
    },
    {
      id: 'counts',
      heading: 'Counts before and after',
      prose:
        'record_scd_counts runs after each pipeline update. It also fails the task if a count does not match the numbers in the use-case spec.',
      diagram: {
        type: 'matrix',
        title: 'scd_run_counts for the reference run',
        description:
          'Before the change batch both tables have 1,000 current rows and no deleted keys; type 2 has 1,000 history rows. After the change batch both tables have 1,020 current rows and 40 deleted keys. Type 1 has 1,020 rows in total. Type 2 has 1,210 rows including 150 keys with more than one version.',
        corner: 'Metric ↓ · Phase →',
        columns: ['Before: scd1 / scd2', 'After: scd1 / scd2'],
        rows: [
          {
            label: 'current_rows',
            cells: [{ state: 'own', text: '1,000 / 1,000' }, { state: 'own', text: '1,020 / 1,020' }],
          },
          {
            label: 'history_rows',
            cells: [{ state: 'own', text: '1,000 / 1,000' }, { state: 'own', text: '1,020 / 1,210' }],
          },
          {
            label: 'keys_with_multiple_rows',
            cells: [{ state: 'none', text: '0 / 0' }, { state: 'own', text: '0 / 150' }],
          },
          {
            label: 'deleted_keys',
            cells: [{ state: 'none', text: '0 / 0' }, { state: 'own', text: '40 / 40' }],
          },
        ],
        legend: [
          { state: 'own', label: 'Changed by the batch' },
          { state: 'none', label: 'Zero or unchanged' },
        ],
        caption: 'Type 2 history: 1,020 current + 150 superseded versions + 40 closed deleted keys = 1,210.',
      },
    },
    {
      id: 'sql',
      heading: 'The pipeline code',
      prose: 'Both flows live in one SQL file. The target tables are created empty and the flows fill them.',
      steps: [
        {
          title: 'Type 1',
          body: 'Deletes come from the change_type column. The feed columns that only drive the flow are excluded.',
        },
        {
          title: 'Type 2',
          body: 'The same flow with STORED AS SCD TYPE 2 adds __START_AT and __END_AT. Current rows are the ones where __END_AT IS NULL.',
        },
      ],
    },
  ],
  related: [
    { slug: 'transformation-patterns', title: 'Transformation patterns' },
    { slug: 'target-loading-outputs', title: 'Target loading and file outputs' },
  ],
};
