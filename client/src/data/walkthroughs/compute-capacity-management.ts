import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'compute-capacity-management',
  area: 'Governance/Monitoring',
  title: 'Compute and capacity management',
  intro:
    'One job reads the shared warehouse settings without changing them, then sends 40 statements at a temporary 2X-Small test warehouse with one cluster. The queue shows up in system.query.history, a dashboard charts it, and the test warehouse is deleted at the end.',
  shortVersion: [
    {
      title: 'Settings are read, not changed.',
      body: 'The SDK returns size, cluster range, auto-stop, type, and channel for every warehouse. The shared warehouse is never resized.',
    },
    {
      title: 'The test warehouse is small and short-lived.',
      body: '2X-Small, serverless, one cluster, 5-minute auto-stop. A task that always runs deletes it.',
    },
    {
      title: '30 of 40 statements waited.',
      body: 'Ten ran at once. The median wait at capacity was 61.1 seconds and the 95th percentile was 117.0 seconds.',
    },
    {
      title: 'System tables hold the evidence.',
      body: 'system.query.history has the wait and run time of each statement. The dashboard reads it with system.compute.warehouse_events.',
    },
    {
      title: 'Isolation is a layout choice.',
      body: 'One warehouse per workload keeps one team’s burst from queueing another team’s statements.',
    },
  ],
  sections: [
    {
      id: 'run',
      heading: 'How the job runs',
      prose:
        'The first task reads settings and builds two workspace-scoped views over the system tables. The load tasks create the test warehouse, fire the statements together, and read the result back once the history table catches up.',
      diagram: {
        type: 'flow',
        title: 'From settings to queueing evidence',
        description:
          'The read_settings task writes warehouse_settings and creates views over system.query.history and system.compute.warehouse_events. create_load_warehouse makes a 2X-Small test warehouse. generate_load submits 40 statements at once. analyze_load waits for system.query.history and writes capacity_load_summary. delete_load_warehouse runs even after a failure and removes the test warehouse. The capacity dashboard reads the views.',
        lanes: [
          { label: 'Read only', fromRow: 0, toRow: 0 },
          { label: 'Load test', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'settings', label: 'read_settings', mono: true, sub: 'SDK, no changes', col: 0, row: 0 },
          { id: 'table', label: 'warehouse_settings', mono: true, col: 1, row: 0, kind: 'store' },
          { id: 'views', label: 'Workspace views', sub: 'query history, events', col: 2, row: 0, kind: 'store' },
          { id: 'dash', label: 'Capacity dashboard', sub: 'AI/BI', col: 3, row: 0, kind: 'surface' },
          { id: 'create', label: 'create_load_warehouse', mono: true, sub: '2X-Small, 1 cluster', col: 0, row: 1 },
          { id: 'load', label: 'generate_load', mono: true, sub: '40 concurrent statements', col: 1, row: 1, kind: 'highlight' },
          { id: 'analyze', label: 'analyze_load', mono: true, sub: 'poll query history', col: 2, row: 1 },
          { id: 'summary', label: 'capacity_load_summary', mono: true, col: 3, row: 1, kind: 'store' },
          { id: 'delete', label: 'delete_load_warehouse', mono: true, sub: 'run_if ALL_DONE', col: 1, row: 2, kind: 'gate' },
        ],
        edges: [
          { from: 'settings', to: 'table' },
          { from: 'settings', to: 'views' },
          { from: 'views', to: 'dash' },
          { from: 'create', to: 'load' },
          { from: 'load', to: 'analyze' },
          { from: 'analyze', to: 'summary' },
          { from: 'analyze', to: 'delete' },
          { from: 'views', to: 'analyze', dashed: true, label: 'same tables' },
        ],
        legend: [
          { kind: 'highlight', label: 'Concurrent load' },
          { kind: 'gate', label: 'Always runs, cleans up' },
          { kind: 'store', label: 'Table or view' },
          { kind: 'surface', label: 'Dashboard' },
        ],
      },
    },
    {
      id: 'settings',
      heading: 'Settings and what the load did',
      prose:
        'The settings came from the SDK. The load numbers came from system.query.history for the 40 statements, joined by statement ID.',
      diagram: {
        type: 'matrix',
        title: 'Warehouse settings and load results',
        description:
          'The shared warehouse is Small with 1 to 1 clusters and a 10-minute auto-stop. The test warehouse is 2X-Small with 1 to 1 clusters and a 5-minute auto-stop. Both are PRO and serverless. Under load the test warehouse queued 30 of 40 statements, with a median wait at capacity of 61.1 seconds and a 95th percentile of 117.0 seconds. Peak running was 10.',
        corner: 'Warehouse ↓ · Setting →',
        columns: ['Size', 'Clusters', 'Auto-stop', 'Type'],
        rows: [
          {
            label: 'Shared warehouse',
            sub: 'read only',
            cells: [
              { state: 'none', text: 'Small' },
              { state: 'none', text: '1 to 1' },
              { state: 'none', text: '10 min' },
              { state: 'none', text: 'PRO serverless' },
            ],
          },
          {
            label: 'Test warehouse',
            sub: 'created, then deleted',
            cells: [
              { state: 'own', text: '2X-Small' },
              { state: 'own', text: '1 to 1' },
              { state: 'own', text: '5 min' },
              { state: 'own', text: 'PRO serverless' },
            ],
          },
        ],
        legend: [
          { state: 'none', label: 'Read, not changed' },
          { state: 'own', label: 'Created by the job' },
        ],
        caption:
          'Load result: 40 statements, 30 queued, median wait at capacity 61.1 s, 95th percentile 117.0 s, longest 117.0 s, at most 10 running at once.',
      },
      table: {
        caption: 'Where each load number comes from',
        columns: ['Number', 'Source'],
        rows: [
          ['Wait at capacity', 'waiting_at_capacity_duration_ms in system.query.history'],
          ['Wait for compute', 'waiting_for_compute_duration_ms (warehouse start)'],
          ['Run time', 'execution_duration_ms'],
          ['Peak running', 'overlap of end time minus run time, up to end time'],
          ['Start, stop, scale', 'system.compute.warehouse_events'],
        ],
      },
    },
    {
      id: 'isolation',
      heading: 'Isolation, pause, and priority',
      prose:
        'A warehouse has no per-query priority. Capacity is shaped by how workloads map to warehouses, how big and how wide each warehouse is, and when it stops.',
      diagram: {
        type: 'flow',
        title: 'One warehouse per workload',
        description:
          'Dashboards, scheduled jobs, and ad hoc analysts each get their own warehouse. Each warehouse has its own size, cluster range, and auto-stop. A burst on the ad hoc warehouse queues only ad hoc statements. Billing and query history attribute cost and waits per warehouse.',
        nodes: [
          { id: 'bi', label: 'Dashboards', sub: 'latency sensitive', col: 0, row: 0 },
          { id: 'jobs', label: 'Scheduled jobs', sub: 'batch SQL', col: 0, row: 1 },
          { id: 'adhoc', label: 'Ad hoc analysts', sub: 'bursty', col: 0, row: 2 },
          { id: 'wbi', label: 'BI warehouse', sub: 'larger, 2+ clusters', col: 1, row: 0, kind: 'highlight' },
          { id: 'wjobs', label: 'Jobs warehouse', sub: 'auto-stop 5 min', col: 1, row: 1 },
          { id: 'wadhoc', label: 'Ad hoc warehouse', sub: 'small, auto-stop 5 min', col: 1, row: 2 },
          { id: 'hist', label: 'system.query.history', mono: true, sub: 'waits per warehouse', col: 2, row: 1, kind: 'store' },
          { id: 'cost', label: 'system.billing.usage', mono: true, sub: 'cost per warehouse', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'bi', to: 'wbi' },
          { from: 'jobs', to: 'wjobs' },
          { from: 'adhoc', to: 'wadhoc' },
          { from: 'wbi', to: 'hist' },
          { from: 'wjobs', to: 'hist' },
          { from: 'wadhoc', to: 'hist' },
          { from: 'hist', to: 'cost', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Sized for latency' },
          { kind: 'store', label: 'System table' },
        ],
        caption: 'This is the documented layout. The job creates only the test warehouse.',
      },
      points: [
        { strong: 'Pause and resume.', text: 'Auto-stop pauses an idle warehouse, and the next statement starts it again. Serverless starts in seconds.' },
        { strong: 'Scale up.', text: 'A larger size makes each statement faster.' },
        { strong: 'Scale out.', text: 'A higher max cluster count adds concurrency, so statements queue less. The test warehouse stays at one cluster, so this run shows queueing only.' },
      ],
    },
    {
      id: 'dashboard',
      heading: 'Read it back and chart it',
      prose:
        'Both views filter on this workspace’s ID at run time, because the system tables hold every workspace in the metastore. The dashboard charts statements per hour by warehouse, the longest wait at capacity, and the settings and events tables.',
      steps: [
        {
          title: 'Per-statement waits',
          body: 'capacity_load_queries holds the wait at capacity, wait for compute, run time, and total time for each of the 40 statements.',
          code: 'SELECT waiting_at_capacity_duration_ms, execution_duration_ms, total_duration_ms\nFROM capacity_load_queries\nORDER BY waiting_at_capacity_duration_ms DESC;',
        },
        {
          title: 'Queueing by hour',
          body: 'sql/capacity_queries.sql groups system.query.history by hour and warehouse and counts the statements that waited.',
        },
        {
          title: 'Events lag',
          body: 'system.compute.warehouse_events had no rows for the test warehouse when the job finished, so the events table on the dashboard shows the shared warehouse.',
        },
      ],
    },
  ],
  related: [
    { slug: 'cost-chargeback', title: 'Cost tracking and chargeback' },
    { slug: 'access-management', title: 'Access management' },
  ],
};
