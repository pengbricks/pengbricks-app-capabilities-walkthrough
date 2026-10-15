import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'sql-notebook-analysis',
  area: 'Analyst Guides',
  title: 'SQL and notebooks at scale',
  intro:
    'One job explores governed tables with SQL, round-trips a result through pandas in a Python notebook, and aggregates 6 million generated rows on serverless compute. An R notebook ships with the bundle but runs on classic compute, because serverless does not run R.',
  shortVersion: [
    {
      title: 'SQL runs as a job task.',
      body: 'Three statements on a SQL warehouse each save a result table: revenue by region and segment, top customers, and a monthly running total.',
    },
    {
      title: 'Python round-trips to pandas.',
      body: 'The notebook collects a query into pandas, pivots it and adds rolling means, then writes it back to Unity Catalog and re-reads it.',
    },
    {
      title: '6 million rows aggregate in seconds.',
      body: 'The reference run wrote 6,000,000 rows in 6.49 s and built a customer-by-month aggregate over them in 4.18 s.',
    },
    {
      title: 'Timings are recorded.',
      body: 'Every step writes its row count and seconds to large_aggregation_timing, so reruns are comparable.',
    },
    {
      title: 'R needs classic compute.',
      body: 'The sparklyr notebook is in the bundle with a note. The job runs the SQL and Python parts only.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'What the job runs',
      prose:
        'The job generates the sample tables from the use-case spec, then runs the three analysis tasks in parallel. The R notebook sits beside them but is not a task.',
      diagram: {
        type: 'flow',
        title: 'From use-case spec to analysis tables',
        description:
          'The use-case spec feeds generate_data, which writes analyst_customers and analyst_orders. Three tasks then run in parallel: sql_exploration writes three SQL result tables, python_pandas_roundtrip writes pandas_region_trend, and large_aggregation writes events_large, events_large_customer_month, and large_aggregation_timing. An R notebook is shown separately because it needs classic compute.',
        lanes: [
          { label: 'Setup', fromRow: 0, toRow: 0 },
          { label: 'Analysis tasks', fromRow: 1, toRow: 1 },
          { label: 'Unity Catalog tables', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'spec', label: 'Use-case spec', sub: 'use_cases/general.yml', col: 0, row: 0 },
          { id: 'gen', label: 'generate_data', mono: true, sub: 'dbldatagen, fixed seed', col: 1, row: 0 },
          { id: 'base', label: 'analyst_* tables', mono: true, sub: '5,000 and 200,000 rows', col: 2, row: 0, kind: 'store' },
          { id: 'sql', label: 'sql_exploration', mono: true, sub: 'SQL warehouse', col: 0, row: 1 },
          { id: 'py', label: 'python_pandas_roundtrip', mono: true, sub: 'serverless notebook', col: 1, row: 1, kind: 'highlight' },
          { id: 'big', label: 'large_aggregation', mono: true, sub: '6,000,000 rows, timed', col: 2, row: 1, kind: 'highlight' },
          { id: 'r', label: 'R notebook', sub: 'classic compute only', col: 3, row: 1, kind: 'surface' },
          { id: 'sqlout', label: 'sql_* tables', mono: true, sub: 'three result tables', col: 0, row: 2, kind: 'store' },
          { id: 'pyout', label: 'pandas_region_trend', mono: true, sub: 'written from pandas', col: 1, row: 2, kind: 'store' },
          { id: 'bigout', label: 'large_aggregation_timing', mono: true, sub: 'step, rows, seconds', col: 2, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'spec', to: 'gen' },
          { from: 'gen', to: 'base' },
          { from: 'base', to: 'sql' },
          { from: 'base', to: 'py' },
          { from: 'base', to: 'big' },
          { from: 'base', to: 'r', dashed: true },
          { from: 'sql', to: 'sqlout' },
          { from: 'py', to: 'pyout' },
          { from: 'big', to: 'bigout' },
        ],
        legend: [
          { kind: 'highlight', label: 'Python on serverless' },
          { kind: 'surface', label: 'Shipped, not run by the job' },
          { kind: 'store', label: 'Unity Catalog table' },
          { kind: 'dashed', label: 'Optional path' },
        ],
      },
    },
    {
      id: 'roundtrip',
      heading: 'The pandas round trip',
      prose:
        'A SQL aggregate leaves Spark as a pandas DataFrame, gets reshaped with pandas, and returns to Unity Catalog as a Delta table. The notebook asserts that the re-read table has the same row count.',
      diagram: {
        type: 'flow',
        title: 'SQL to pandas and back',
        description:
          'A Spark SQL query aggregates revenue by region and month. toPandas collects the result. pandas pivots it by region and adds a three-month rolling mean and month-over-month growth. createDataFrame writes the result to pandas_region_trend. The notebook reads the table back and checks the row count.',
        nodes: [
          { id: 'query', label: 'Spark SQL', sub: 'revenue by region, month', col: 0, row: 0 },
          { id: 'pandas', label: 'toPandas()', mono: true, sub: 'collect to the driver', col: 1, row: 0 },
          { id: 'shape', label: 'pandas', sub: 'pivot, rolling, growth', col: 2, row: 0, kind: 'highlight' },
          { id: 'write', label: 'createDataFrame()', mono: true, sub: 'saveAsTable', col: 3, row: 0 },
          { id: 'table', label: 'pandas_region_trend', mono: true, col: 3, row: 1, kind: 'store' },
          { id: 'check', label: 'Row count check', sub: 'assert on re-read', col: 2, row: 1, kind: 'gate' },
        ],
        edges: [
          { from: 'query', to: 'pandas' },
          { from: 'pandas', to: 'shape' },
          { from: 'shape', to: 'write' },
          { from: 'write', to: 'table' },
          { from: 'table', to: 'check', label: 'read back' },
        ],
        legend: [
          { kind: 'highlight', label: 'Runs on the driver' },
          { kind: 'gate', label: 'Fails the task on mismatch' },
        ],
      },
      steps: [
        {
          title: 'Collect',
          body: 'Aggregate in Spark first so only a few hundred rows reach pandas.',
          code: "monthly = spark.sql(\"SELECT c.region, DATE_TRUNC('MONTH', o.order_ts) AS month, ...\").toPandas()",
        },
        {
          title: 'Reshape',
          body: 'Pivot by region, then add a rolling mean and growth columns.',
          code: 'wide = monthly.pivot(index="month", columns="region", values="revenue")\nrolling = wide.rolling(3).mean().add_suffix("_3mo_avg")',
        },
        {
          title: 'Write back',
          body: 'Spark takes the pandas frame and saves a governed table.',
          code: 'spark.createDataFrame(result).write.mode("overwrite").saveAsTable(target)',
        },
      ],
    },
    {
      id: 'scale',
      heading: 'Timings for 6 million rows',
      prose:
        'large_aggregation generates the table, scans it, and runs two aggregations. Each step writes its row count and seconds to large_aggregation_timing. Serverless SQL and Spark do the work, so the notebook needs no cluster sizing.',
      diagram: {
        type: 'matrix',
        title: 'Recorded timings, reference run',
        description:
          'generate_and_write_events wrote 6,000,000 rows in 6.49 seconds. full_scan_count counted 6,000,000 rows in 0.42 seconds. aggregate_customer_by_month returned 59,594 rows in 4.18 seconds. aggregate_percentiles_by_type returned 4 rows in 0.83 seconds.',
        corner: 'Step ↓ · Result →',
        columns: ['Rows', 'Seconds'],
        rows: [
          { label: 'generate_and_write', sub: 'dbldatagen to Delta', cells: [{ state: 'own', text: '6,000,000' }, { state: 'own', text: '6.49' }] },
          { label: 'full_scan_count', sub: 'count(*)', cells: [{ state: 'own', text: '6,000,000' }, { state: 'own', text: '0.42' }] },
          { label: 'customer_by_month', sub: 'group by, write table', cells: [{ state: 'own', text: '59,594' }, { state: 'own', text: '4.18' }] },
          { label: 'percentiles_by_type', sub: 'percentile_approx', cells: [{ state: 'own', text: '4' }, { state: 'own', text: '0.83' }] },
        ],
        legend: [{ state: 'own', label: 'Recorded in large_aggregation_timing' }],
        caption: 'Run 1119284534838043. Timings vary with warehouse and serverless load, so compare reruns in the timing table.',
      },
    },
    {
      id: 'r',
      heading: 'R on Databricks',
      points: [
        {
          strong: 'Serverless does not run R.',
          text: 'Serverless notebooks and jobs run Python and SQL. The job leaves the R notebook out so the run stays green.',
        },
        {
          strong: 'Use sparklyr on classic compute.',
          text: 'src/notebooks/r_sparklyr_summary.r aggregates in Spark, collects a small result into R, runs summary(), quantile(), and lm(), and writes a Delta table.',
        },
        {
          strong: 'Same governed tables.',
          text: 'The R notebook reads the same analyst_orders and analyst_customers tables, so Unity Catalog permissions apply unchanged.',
        },
      ],
    },
  ],
  related: [
    { slug: 'bring-your-own-data', title: 'Bring your own data' },
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
  ],
};
