import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-observability',
  area: 'Data Engineering Guides',
  title: 'Lineage and drift detection',
  intro:
    'A job builds a source, silver, and gold chain, then reads its lineage back from system tables. It changes a table schema and catches the change from table history. It loads a later batch with a shifted distribution and flags it with a data profiling monitor and two in-job checks.',
  shortVersion: [
    {
      title: 'Lineage comes from system tables.',
      body: 'system.access.table_lineage returned silver to gold and source to silver, and column_lineage returned 10 column edges.',
    },
    {
      title: 'Schema drift comes from snapshots.',
      body: 'Two information_schema snapshots differ by one added column and one changed type.',
    },
    {
      title: 'DESCRIBE HISTORY names the versions.',
      body: 'ADD COLUMNS at version 1 and CHANGE COLUMN at version 3 match the two events.',
    },
    {
      title: 'A monitor flags the shifted batch.',
      body: 'The monitor on the batches table shows a Wasserstein distance of 72.56 on amount between its last two windows.',
    },
    {
      title: 'The job checks the same shift itself.',
      body: 'PSI on amount is 4.94 against a limit of 0.2, and the mean moves from 105.6 to 250.9.',
    },
  ],
  sections: [
    {
      id: 'job',
      heading: 'What the job does',
      prose:
        'Four tasks run in one job. Lineage and schema drift both start from the chain build. Data drift has its own table and runs alongside them. Each task writes its findings to Unity Catalog tables.',
      diagram: {
        type: 'flow',
        title: 'Tasks and the tables they write',
        description:
          'build_chain creates obs_source_orders, obs_silver_orders, and obs_gold_daily_revenue. read_lineage and detect_schema_drift both depend on build_chain. read_lineage writes obs_lineage_edges and obs_column_lineage. detect_schema_drift writes obs_schema_snapshots and obs_schema_drift_events. detect_data_drift has no upstream task and writes obs_drift_results and the monitor tables.',
        lanes: [
          { label: 'Tasks', fromRow: 0, toRow: 1 },
          { label: 'Tables written', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'chain', label: 'build_chain', mono: true, sub: 'source, silver, gold', col: 0, row: 0 },
          { id: 'lineage', label: 'read_lineage', mono: true, sub: 'polls system tables', col: 1, row: 0, kind: 'highlight' },
          { id: 'schema', label: 'detect_schema_drift', mono: true, sub: 'ALTER, then diff', col: 2, row: 0, kind: 'highlight' },
          { id: 'data', label: 'detect_data_drift', mono: true, sub: 'monitor, PSI, mean', col: 3, row: 1, kind: 'highlight' },
          { id: 'ltables', label: 'obs_lineage_edges', mono: true, sub: 'plus obs_column_lineage', col: 1, row: 2, kind: 'store' },
          { id: 'stables', label: 'obs_schema_drift_events', mono: true, sub: 'plus snapshots', col: 2, row: 2, kind: 'store' },
          { id: 'dtables', label: 'obs_drift_results', mono: true, sub: 'plus monitor tables', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'chain', to: 'lineage' },
          { from: 'chain', to: 'schema' },
          { from: 'lineage', to: 'ltables' },
          { from: 'schema', to: 'stables' },
          { from: 'data', to: 'dtables' },
        ],
        legend: [
          { kind: 'highlight', label: 'Detection task' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'lineage',
      heading: 'Lineage from system tables',
      prose:
        'The chain is built with CREATE OR REPLACE TABLE AS SELECT. Lineage reached system.access.table_lineage about 13 minutes after the writes, so the task polls every 30 seconds. It then walks upstream from gold.',
      diagram: {
        type: 'flow',
        title: 'Three tables, two hops',
        description:
          'obs_source_orders feeds obs_silver_orders, which feeds obs_gold_daily_revenue. Silver keeps rows with a positive amount. Gold aggregates silver by day and region. Column lineage maps amount to revenue and order_ts to order_date.',
        nodes: [
          { id: 'src', label: 'obs_source_orders', mono: true, sub: '3,000 rows', col: 0, row: 0, kind: 'store' },
          { id: 'silver', label: 'obs_silver_orders', mono: true, sub: '3,000 rows', col: 1, row: 0, kind: 'store' },
          { id: 'gold', label: 'obs_gold_daily_revenue', mono: true, sub: '120 rows', col: 2, row: 0, kind: 'store' },
        ],
        edges: [
          { from: 'src', to: 'silver', label: 'hop 2 upstream' },
          { from: 'silver', to: 'gold', label: 'hop 1 upstream' },
        ],
        legend: [{ kind: 'store', label: 'Unity Catalog table' }],
        caption: 'Column lineage maps amount to revenue and order_ts to order_date.',
      },
    },
    {
      id: 'schema',
      heading: 'Schema drift',
      prose:
        'The job snapshots information_schema for the silver table, adds a column, widens a type with Delta type widening, and snapshots again. The diff gives two events. DESCRIBE HISTORY supplies the version of each change.',
      diagram: {
        type: 'matrix',
        title: 'Drift events on obs_silver_orders',
        description:
          'The loyalty_tier column was added, shown by ADD COLUMNS at history version 1. The quantity column changed type from int to long, shown by CHANGE COLUMN at version 3. Version 2 set the type widening table property.',
        corner: 'Column ↓ · Evidence →',
        columns: ['Before', 'After', 'DESCRIBE HISTORY'],
        rows: [
          {
            label: 'loyalty_tier',
            sub: 'COLUMN_ADDED',
            cells: [
              { state: 'none', text: 'absent' },
              { state: 'own', text: 'string' },
              { state: 'own', text: 'v1 ADD COLUMNS' },
            ],
          },
          {
            label: 'quantity',
            sub: 'TYPE_CHANGED',
            cells: [
              { state: 'own', text: 'int' },
              { state: 'own', text: 'long' },
              { state: 'own', text: 'v3 CHANGE COLUMN' },
            ],
          },
          {
            label: 'amount',
            sub: 'unchanged',
            cells: [
              { state: 'optional', text: 'double' },
              { state: 'optional', text: 'double' },
              { state: 'none', text: 'no entry' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Part of a drift event' },
          { state: 'optional', label: 'Unchanged' },
          { state: 'none', label: 'Not present' },
        ],
        caption: 'Version 2 set delta.enableTypeWidening, which the type change needs.',
      },
    },
    {
      id: 'data-drift',
      heading: 'Data drift',
      prose:
        'The baseline batch has 3,000 orders with amounts from 10 to 200. The later batch has 3,000 orders with amounts from 120 to 380 and most orders in one region. A data profiling monitor refreshes before and after the later batch. The job also computes PSI and the mean shift itself.',
      table: {
        caption: 'Results in obs_drift_results and the monitor drift table',
        columns: ['Check', 'Result'],
        rows: [
          ['PSI on amount', '4.94 (limit 0.2), flagged'],
          ['PSI on region', '1.89 (limit 0.2), flagged'],
          ['Mean of amount', '105.6 to 250.9, +137.5% (limit 15%), flagged'],
          ['Monitor, amount', 'Wasserstein distance 0.0 in window 1, 72.56 in window 2'],
          ['Monitor, region', 'Jensen-Shannon distance 0.0 in window 1, 0.253 in window 2'],
        ],
      },
      points: [
        {
          strong: 'Why the first window shows 0.',
          text: 'Creating the monitor starts a refresh and the job asks for another, so the first two windows both see the baseline. The shift shows up in the third.',
        },
        {
          strong: 'The monitor is created by the job.',
          text: 'The bundle does not declare it, so the job deletes and recreates it on each run.',
        },
      ],
    },
  ],
  related: [
    { slug: 'orchestration-patterns', title: 'Orchestration patterns' },
    { slug: 'monitoring', title: 'Platform observability' },
  ],
};
