import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'transformation-patterns',
  area: 'Data Engineering Guides',
  title: 'Transformation patterns',
  intro:
    'Write transformations as Lakeflow Spark Declarative Pipelines: each dataset is one SQL query, and the pipeline works out the order, the incremental processing, and the quality checks. This page covers which dataset type to use, how to keep updates incremental, how to handle bad values, and the ten SQL patterns most ETL work reuses.',
  shortVersion: [
    {
      title: 'Declare datasets and let the pipeline run them.',
      body: 'Write each table or view as a query. The pipeline resolves dependencies, so you do not order steps by hand.',
    },
    {
      title: 'Pick the dataset type by job.',
      body: 'Streaming tables ingest append-only data, materialized views hold transformations and aggregates, and views hold intermediate logic.',
    },
    {
      title: 'Update incrementally. Do not full refresh every run.',
      body: 'On a serverless pipeline, a materialized view refreshes only what changed when its query supports it. Save full refresh for a logic change or a backfill.',
    },
    {
      title: 'Put quality rules in expectations.',
      body: 'try_cast turns a bad value into NULL. An expectation then warns, drops the row, or fails the update, and records the count in the event log.',
    },
    {
      title: 'Prefer built-in SQL, and let Databricks choose the layout.',
      body: 'Built-in and higher-order functions beat UDFs. CLUSTER BY AUTO lets liquid clustering pick clustering keys from how the table is queried.',
    },
  ],
  sections: [
    {
      id: 'datasets',
      heading: 'Choose the dataset type',
      prose:
        'Layer datasets as bronze (raw), silver (cleaned and conformed), and gold (business-ready). The type you pick for each decides how it refreshes.',
      table: {
        columns: ['Need', 'Use'],
        rows: [
          ['Ingest files or messages that only append', 'Streaming table, read with Auto Loader or read_files'],
          ['Cleaned, joined, or aggregated data that others query', 'Materialized view'],
          ['Logic you reuse in one pipeline and do not need stored', 'View'],
          ['Row-by-row change feeds with updates and deletes', 'AUTO CDC into a streaming table'],
        ],
      },
      links: [
        {
          label: 'Lakeflow Spark Declarative Pipelines',
          url: 'https://docs.databricks.com/aws/en/ldp/',
          note: 'Dataset types, pipeline modes, and the editor.',
        },
      ],
    },
    {
      id: 'refresh',
      heading: 'Update incrementally',
      prose:
        'A normal update processes new input only. A materialized view on a serverless pipeline detects what changed in its sources and recomputes just that part when the query is supported. Row tracking on the source tables makes more query shapes eligible, and deletion vectors and change data feed help further. A full refresh recomputes everything, so run one on purpose: after you change logic, fix bad history, or backfill.',
      points: [
        {
          strong: 'Test a query before you ship it.',
          text: 'EXPLAIN CREATE MATERIALIZED VIEW reports whether the query can refresh incrementally and why not if it cannot.',
        },
        {
          strong: 'Schedule normal updates.',
          text: 'Run the pipeline from a Lakeflow Job on a schedule or a table-update trigger. Do not set full_refresh on a recurring task.',
        },
        {
          strong: 'Keep the pipeline serverless.',
          text: 'Incremental materialized view refresh needs serverless compute, which also removes cluster sizing.',
        },
      ],
      examples: [
        {
          label: 'Check whether a materialized view refreshes incrementally',
          language: 'sql',
          code: 'EXPLAIN CREATE MATERIALIZED VIEW daily_revenue AS\nSELECT order_date, region, SUM(amount) AS revenue\nFROM silver_orders\nGROUP BY order_date, region;',
          notes: ['The output names the refresh technique the planner would use, such as incremental aggregation or complete recompute.'],
        },
      ],
      links: [
        {
          label: 'Incremental refresh for materialized views',
          url: 'https://docs.databricks.com/aws/en/optimizations/incremental-refresh',
          note: 'Which SQL supports incremental refresh and what to enable on source tables.',
        },
      ],
    },
    {
      id: 'quality',
      heading: 'Enforce quality with expectations',
      prose:
        'An expectation is a SQL condition on a dataset. By default it keeps the row and counts the violation. You can drop the row or stop the update instead. The counts land in the pipeline event log, so one place shows how much data failed each rule.',
      table: {
        columns: ['Action', 'Behavior'],
        rows: [
          ['EXPECT (condition)', 'Keep the row and record the violation'],
          ['ON VIOLATION DROP ROW', 'Drop the row and record the count'],
          ['ON VIOLATION FAIL UPDATE', 'Stop the update until someone fixes the data'],
        ],
      },
      links: [
        {
          label: 'Manage data quality with pipeline expectations',
          url: 'https://docs.databricks.com/aws/en/ldp/expectations',
          note: 'Actions, multiple expectations, and recommended patterns.',
        },
      ],
    },
    {
      id: 'casting',
      heading: 'Cast safely, then reject or repair',
      prose:
        'Use try_cast so one bad value does not fail the update. Then decide what the bad rows deserve. Drop them with an expectation when you only need the count, or route them to a reject table with a reason when someone must fix the source.',
      diagram: {
        type: 'flow',
        title: 'Valid rows and rejected rows',
        description:
          'Raw orders are cast with try_cast. A row whose amount and quantity both cast goes to the valid table. Any other row goes to a reject table with a reason. Downstream views read only the valid table.',
        nodes: [
          { id: 'orders', label: 'Raw orders', sub: 'values stored as text', col: 0, row: 0, kind: 'store' },
          { id: 'gate', label: 'Both casts succeed?', sub: 'try_cast', col: 1, row: 0, kind: 'gate' },
          { id: 'valid', label: 'Valid orders', sub: 'typed columns', col: 2, row: 0, kind: 'store' },
          { id: 'rejects', label: 'Rejects', sub: 'row plus reason', col: 2, row: 1, kind: 'store' },
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
      examples: [
        {
          label: 'Drop bad rows with an expectation',
          language: 'sql',
          code: 'CREATE OR REFRESH MATERIALIZED VIEW silver_orders (\n  CONSTRAINT amount_is_numeric EXPECT (amount IS NOT NULL) ON VIOLATION DROP ROW\n) AS\nSELECT order_id, try_cast(amount_raw AS DECIMAL(12,2)) AS amount\nFROM bronze_orders;',
          notes: ['The expectation drops the row and records the count in the pipeline event log. Keep the reject table when you need the rows themselves.'],
        },
      ],
    },
    {
      id: 'patterns',
      heading: 'Ten patterns worth reusing',
      prose: 'Most ETL work combines a few of these. Each is one materialized view in the reference code.',
      diagram: {
        type: 'matrix',
        title: 'Pattern and the SQL it leans on',
        description:
          'Lookup enrichment uses LEFT JOIN. Joins use inner, left, and full types. String functions use trim, initcap, and regexp. Null handling uses coalesce and nullif. Dates use try_to_date and from_utc_timestamp. Casting uses try_cast. Running totals use a window sum. Pivot uses PIVOT and UNPIVOT. Last record uses QUALIFY. Group iteration uses transform and aggregate.',
        corner: 'Pattern ↓ · Detail →',
        columns: ['Use it to', 'Key SQL'],
        rows: [
          { label: 'Lookup enrichment', cells: [{ state: 'own', text: 'Add reference data' }, { state: 'own', text: 'LEFT JOIN' }] },
          { label: 'Joins', cells: [{ state: 'own', text: 'Combine two datasets' }, { state: 'own', text: 'INNER, LEFT, FULL' }] },
          { label: 'String functions', cells: [{ state: 'own', text: 'Standardize text' }, { state: 'own', text: 'trim, initcap' }] },
          { label: 'Null and conditional', cells: [{ state: 'own', text: 'Fill or branch' }, { state: 'own', text: 'coalesce, CASE' }] },
          { label: 'Date and time', cells: [{ state: 'own', text: 'Parse and shift zones' }, { state: 'own', text: 'from_utc_timestamp' }] },
          { label: 'Cast with rejects', cells: [{ state: 'own', text: 'Type raw columns' }, { state: 'own', text: 'try_cast' }] },
          { label: 'Running totals', cells: [{ state: 'own', text: 'Cumulative measures' }, { state: 'own', text: 'window sum' }] },
          { label: 'Pivot and unpivot', cells: [{ state: 'own', text: 'Reshape rows and columns' }, { state: 'own', text: 'PIVOT, UNPIVOT' }] },
          { label: 'Last record per group', cells: [{ state: 'own', text: 'Dedupe to the latest' }, { state: 'own', text: 'QUALIFY' }] },
          { label: 'Per-group iteration', cells: [{ state: 'own', text: 'Loop inside a group' }, { state: 'own', text: 'transform, aggregate' }] },
        ],
        legend: [{ state: 'own', label: 'One materialized view each' }],
      },
    },
    {
      id: 'joins',
      heading: 'Pick the join by what you keep',
      prose:
        'The join type decides which unmatched rows survive. Use an inner join when an unmatched row is not useful, a left join when the left side is the record of truth, and a full join when you are reconciling two sources and need to see the gaps.',
      diagram: {
        type: 'matrix',
        title: 'Rows kept by join type',
        description:
          'An inner join keeps only matched rows. A left join keeps matched rows and rows that exist only on the left. A full join also keeps rows that exist only on the right.',
        corner: 'Join ↓ · Rows →',
        columns: ['Matched', 'Left only', 'Right only'],
        rows: [
          { label: 'INNER JOIN', cells: [{ state: 'own', text: 'kept' }, { state: 'none', text: 'dropped' }, { state: 'none', text: 'dropped' }] },
          { label: 'LEFT JOIN', cells: [{ state: 'own', text: 'kept' }, { state: 'own', text: 'kept' }, { state: 'none', text: 'dropped' }] },
          { label: 'FULL JOIN', cells: [{ state: 'own', text: 'kept' }, { state: 'own', text: 'kept' }, { state: 'own', text: 'kept' }] },
        ],
        legend: [
          { state: 'own', label: 'Kept' },
          { state: 'none', label: 'Dropped' },
        ],
      },
    },
    {
      id: 'performance',
      heading: 'Keep transformations fast',
      points: [
        {
          strong: 'Use built-in functions.',
          text: 'Built-in and higher-order functions such as transform, filter, and aggregate run inside the engine. A Python UDF moves rows out of it.',
        },
        {
          strong: 'Dedupe with QUALIFY.',
          text: 'QUALIFY ROW_NUMBER() OVER (...) = 1 keeps the latest row per key without a subquery.',
        },
        {
          strong: 'Let liquid clustering choose the layout.',
          text: 'Add CLUSTER BY AUTO to a pipeline table, or name the columns with CLUSTER BY. Prefer it to partitioning, which is hard to change later.',
        },
        {
          strong: 'Enable predictive optimization.',
          text: 'It runs maintenance on Unity Catalog managed tables so you do not schedule OPTIMIZE and VACUUM yourself.',
        },
      ],
      links: [
        {
          label: 'Liquid clustering',
          url: 'https://docs.databricks.com/aws/en/delta/clustering',
          note: 'Choosing clustering keys and automatic liquid clustering.',
        },
        {
          label: 'Predictive optimization',
          url: 'https://docs.databricks.com/aws/en/optimizations/predictive-optimization',
        },
      ],
    },
  ],
  related: [
    { slug: 'scd-change-capture', title: 'SCD and change capture' },
    { slug: 'target-loading-outputs', title: 'Target loading and file outputs' },
  ],
};
