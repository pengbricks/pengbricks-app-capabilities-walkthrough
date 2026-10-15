import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'transformation-patterns',
  area: 'Data Engineering Guides',
  title: 'Transformation patterns',
  intro:
    'One Lakeflow Declarative Pipeline in SQL holds ten common ETL patterns as 14 materialized views. A job generates messy source data, runs the pipeline, and checks the row count of every view against an independent query.',
  shortVersion: [
    {
      title: 'One view per pattern.',
      body: 'Each SQL file defines the materialized views for one pattern, so a pattern is easy to find and copy.',
    },
    {
      title: 'The inputs are messy on purpose.',
      body: 'Names mix case and spaces, dates arrive in three formats, and 524 of 12,000 orders carry values that do not cast.',
    },
    {
      title: 'Bad casts go to a reject table.',
      body: 'try_cast returns NULL instead of failing. Failed rows land in tp_cast_rejects with a reason.',
    },
    {
      title: 'Joins show what each type keeps.',
      body: 'The full join returns 11,000 matched rows, 1,000 orders with no customer, and 100 customers with no orders.',
    },
    {
      title: 'Counts are checked.',
      body: 'The job compares each view with its own expected count and fails if any differ.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'How the job runs',
      prose:
        'The use-case spec holds the domain. The job builds three source tables from it, runs the pipeline with a full refresh, then checks every view.',
      diagram: {
        type: 'flow',
        title: 'From spec to checked views',
        description:
          'The use-case spec feeds generate_sources, which writes the de_customers, de_orders, and regions tables. The pipeline reads those tables and writes 14 materialized views. check_row_counts reads both the sources and the views and writes tp_view_counts.',
        lanes: [
          { label: 'Configuration in Git', fromRow: 0, toRow: 0 },
          { label: 'Lakeflow job', fromRow: 1, toRow: 1 },
          { label: 'Unity Catalog tables', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'spec', label: 'Use-case spec', sub: 'use_cases/general.yml', col: 0, row: 0 },
          { id: 'sql', label: 'Pattern SQL files', sub: 'src/transformations', col: 2, row: 0, kind: 'surface' },
          { id: 'gen', label: 'generate_sources', mono: true, sub: 'dbldatagen, fixed seed', col: 0, row: 1 },
          { id: 'pipe', label: 'Pipeline update', sub: 'full refresh', col: 1, row: 1, kind: 'highlight' },
          { id: 'check', label: 'check_row_counts', mono: true, sub: 'fail on any mismatch', col: 2, row: 1 },
          { id: 'src', label: 'de_customers, de_orders', mono: true, sub: 'plus regions lookup', col: 0, row: 2, kind: 'store' },
          { id: 'mvs', label: 'tp_* views', mono: true, sub: '14 materialized views', col: 1, row: 2, kind: 'store' },
          { id: 'counts', label: 'tp_view_counts', mono: true, sub: 'actual vs expected', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'spec', to: 'gen' },
          { from: 'gen', to: 'src' },
          { from: 'sql', to: 'pipe' },
          { from: 'gen', to: 'pipe' },
          { from: 'src', to: 'mvs', label: 'read' },
          { from: 'pipe', to: 'check' },
          { from: 'mvs', to: 'counts' },
          { from: 'check', to: 'counts' },
        ],
        legend: [
          { kind: 'highlight', label: 'Declarative Pipeline' },
          { kind: 'surface', label: 'SQL in Git' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'patterns',
      heading: 'The ten patterns',
      prose: 'Each pattern lives in its own SQL file. The table lists the view each one produces and the SQL it leans on.',
      diagram: {
        type: 'matrix',
        title: 'Pattern, view, and key SQL',
        description:
          'Ten patterns with the materialized views they produce and the main SQL feature each uses. Lookup enrichment uses LEFT JOIN. Joins produce three views. String functions use trim, initcap, and regexp. Null handling uses coalesce and nullif. Dates use try_to_date and from_utc_timestamp. Casting uses try_cast. Running totals use a window sum. Pivot uses PIVOT and UNPIVOT. Last record uses QUALIFY. Group iteration uses transform and aggregate.',
        corner: 'Pattern ↓ · Detail →',
        columns: ['Views', 'Key SQL'],
        rows: [
          { label: 'Lookup enrichment', cells: [{ state: 'own', text: '1 view' }, { state: 'own', text: 'LEFT JOIN' }] },
          { label: 'Inner, left, full joins', cells: [{ state: 'own', text: '3 views' }, { state: 'own', text: 'JOIN types' }] },
          { label: 'String functions', cells: [{ state: 'own', text: '1 view' }, { state: 'own', text: 'trim, initcap' }] },
          { label: 'Null and conditional', cells: [{ state: 'own', text: '1 view' }, { state: 'own', text: 'coalesce, CASE' }] },
          { label: 'Date and time', cells: [{ state: 'own', text: '1 view' }, { state: 'own', text: 'from_utc_timestamp' }] },
          { label: 'Cast with rejects', cells: [{ state: 'own', text: '2 views' }, { state: 'own', text: 'try_cast' }] },
          { label: 'Running totals', cells: [{ state: 'own', text: '1 view' }, { state: 'own', text: 'window sum' }] },
          { label: 'Pivot and unpivot', cells: [{ state: 'own', text: '2 views' }, { state: 'own', text: 'PIVOT, UNPIVOT' }] },
          { label: 'Last record per group', cells: [{ state: 'own', text: '1 view' }, { state: 'own', text: 'QUALIFY' }] },
          { label: 'Per-group iteration', cells: [{ state: 'own', text: '1 view' }, { state: 'own', text: 'transform, aggregate' }] },
        ],
        legend: [{ state: 'own', label: 'Produced by this pattern' }],
        caption: 'Total: 14 materialized views, all prefixed tp_.',
      },
    },
    {
      id: 'joins',
      heading: 'What each join keeps',
      prose:
        'Orders for customers that do not exist and customers with no orders are planted in the data, so the three join types return different counts.',
      diagram: {
        type: 'matrix',
        title: 'Rows kept by join type',
        description:
          'Inner join keeps 11,000 matched rows. Left join keeps those plus 1,000 orders with no customer, 12,000 in total. Full join also keeps 100 customers with no orders, 12,100 in total.',
        corner: 'Join ↓ · Rows →',
        columns: ['Matched', 'Order only', 'Customer only'],
        rows: [
          {
            label: 'tp_join_inner',
            sub: '11,000 rows',
            cells: [{ state: 'own', text: '11,000' }, { state: 'none', text: 'dropped' }, { state: 'none', text: 'dropped' }],
          },
          {
            label: 'tp_join_left',
            sub: '12,000 rows',
            cells: [{ state: 'own', text: '11,000' }, { state: 'own', text: '1,000' }, { state: 'none', text: 'dropped' }],
          },
          {
            label: 'tp_join_full',
            sub: '12,100 rows',
            cells: [{ state: 'own', text: '11,000' }, { state: 'own', text: '1,000' }, { state: 'own', text: '100' }],
          },
        ],
        legend: [
          { state: 'own', label: 'Kept' },
          { state: 'none', label: 'Dropped' },
        ],
      },
    },
    {
      id: 'casting',
      heading: 'Casting with a reject path',
      prose:
        'The de_orders table stores amounts and quantities as text. Values such as N/A and abc fail to cast. They go to a reject table with the reason, and the job checks that valid and rejected rows add up to every order.',
      diagram: {
        type: 'flow',
        title: 'Valid rows and rejected rows',
        description:
          'The de_orders table is cast with try_cast. A row whose amount and quantity both cast goes to tp_cast_valid, 11,476 rows. Any other row goes to tp_cast_rejects with a reject reason, 524 rows. Downstream running totals, pivot, last record, and iteration views read only tp_cast_valid.',
        nodes: [
          { id: 'orders', label: 'de_orders', mono: true, sub: '12,000 rows', col: 0, row: 0, kind: 'store' },
          { id: 'gate', label: 'Both casts succeed?', sub: 'try_cast', col: 1, row: 0, kind: 'gate' },
          { id: 'valid', label: 'tp_cast_valid', mono: true, sub: '11,476 rows', col: 2, row: 0, kind: 'store' },
          { id: 'rejects', label: 'tp_cast_rejects', mono: true, sub: '524 rows, with reason', col: 2, row: 1, kind: 'store' },
          { id: 'down', label: 'Downstream views', sub: 'totals, pivot, last', col: 3, row: 0, kind: 'highlight' },
        ],
        edges: [
          { from: 'orders', to: 'gate' },
          { from: 'gate', to: 'valid', label: 'yes' },
          { from: 'gate', to: 'rejects', label: 'no' },
          { from: 'valid', to: 'down' },
        ],
        legend: [
          { kind: 'gate', label: 'Row-level decision' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'checks',
      heading: 'Row count checks',
      prose:
        'check_row_counts runs one query per view on the sources and compares the result with the view. The reference run matched on all 14 views.',
      table: {
        columns: ['View', 'Rows (matches expected)'],
        rows: [
          ['tp_lookup_enrichment', '2,000 (1,823 matched, 122 unmatched code, 55 missing code)'],
          ['tp_join_inner / left / full', '11,000 / 12,000 / 12,100'],
          ['tp_string_functions, tp_null_conditional', '2,000 each'],
          ['tp_date_time', '12,000'],
          ['tp_cast_valid / tp_cast_rejects', '11,476 / 524'],
          ['tp_running_totals', '724 (one per category and day)'],
          ['tp_pivot / tp_unpivot', '4 / 12'],
          ['tp_last_record, tp_group_iteration', '2,100 each (one per customer id with valid orders)'],
        ],
      },
    },
  ],
  related: [
    { slug: 'scd-change-capture', title: 'SCD and change capture' },
    { slug: 'target-loading-outputs', title: 'Target loading and file outputs' },
  ],
};
