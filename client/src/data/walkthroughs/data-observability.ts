import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-observability',
  area: 'Data Engineering Guides',
  title: 'Lineage and drift detection',
  intro:
    'Unity Catalog records lineage for you, and data quality monitoring watches tables for freshness, completeness, and distribution changes. This page covers how to trace lineage from system tables, how to catch schema changes, how to monitor data drift on a schedule, and where to put quality rules so problems stop at the source.',
  businessValue: {
    summary:
      'Data owners need to learn about broken or stale data before a business user does. Unity Catalog lineage and data quality monitoring show what feeds what and flag unusual changes on a schedule.',
    outcomes: [
      {
        title: 'Impact known before a change',
        body: 'Automatic table and column lineage shows which tables, dashboards, and jobs depend on a table. Owners check the downstream effect before altering it.',
      },
      {
        title: 'Stale or incomplete tables flagged',
        body: 'Anomaly detection checks freshness and completeness for every table in a schema. It is Public Preview, so confirm its status before depending on it.',
      },
      {
        title: 'Drift alerts reach the owner',
        body: 'Scheduled monitors refresh metrics tables, and an alert on a drift metric notifies an owner before a consumer finds the problem.',
      },
      {
        title: 'Schema changes have a record',
        body: 'DESCRIBE HISTORY lists each schema change with its version, time, and user. Teams can see who changed a column that broke a report.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Lineage is automatic.',
      body: 'Unity Catalog captures table and column lineage from queries and pipelines. Read it from system.access tables or Catalog Explorer, and check it before you change a table.',
    },
    {
      title: 'Schema changes have a record.',
      body: 'DESCRIBE HISTORY lists each schema change with its version, time, and user. Compare information_schema snapshots to watch many tables at once.',
    },
    {
      title: 'Turn on data quality monitoring.',
      body: 'Anomaly detection checks the freshness and completeness of every table in a schema. Data profiling tracks column statistics and drift on tables you choose.',
    },
    {
      title: 'Run monitors on a schedule and alert on them.',
      body: 'A schedule refreshes the metrics tables without a job, and an alert on a drift metric tells an owner before a consumer finds the problem.',
    },
    {
      title: 'Stop bad data at the source.',
      body: 'Pipeline expectations drop or fail on bad records and write counts to the event log. Monitors then catch what the rules did not anticipate.',
    },
  ],
  sections: [
    {
      id: 'lineage',
      heading: 'Lineage from system tables',
      prose:
        'system.access.table_lineage records which table each table was built from, and system.access.column_lineage does the same for columns. Lineage is not instant: events reach the system tables after a delay, so read them on a schedule instead of right after a write. Catalog Explorer shows the same data as a graph.',
      diagram: {
        type: 'flow',
        title: 'Three tables, two hops',
        description:
          'A source table feeds a silver table, which feeds a gold table. Silver keeps valid rows. Gold aggregates silver by day and region. Column lineage maps amount to revenue and order_ts to order_date.',
        nodes: [
          {
            id: 'src',
            label: 'Source orders',
            sub: 'raw',
            col: 0,
            row: 0,
            kind: 'store',
            domain: 'data',
            icon: 'database',
            detail: 'The raw orders table, two hops upstream of the gold table in table lineage.',
          },
          {
            id: 'silver',
            label: 'Silver orders',
            sub: 'valid rows',
            col: 1,
            row: 0,
            kind: 'store',
            domain: 'data',
            icon: 'database',
            detail: 'Keeps valid rows from the source. Column lineage maps order_ts to order_date downstream.',
          },
          {
            id: 'gold',
            label: 'Gold daily revenue',
            sub: 'day and region',
            col: 2,
            row: 0,
            kind: 'store',
            domain: 'data',
            icon: 'database',
            detail: 'Aggregates silver by day and region. Column lineage maps amount to revenue.',
          },
        ],
        edges: [
          { from: 'src', to: 'silver', label: 'hop 2 upstream' },
          { from: 'silver', to: 'gold', label: 'hop 1 upstream' },
        ],
        legend: [{ kind: 'store', label: 'Unity Catalog table' }],
        caption: 'Column lineage maps amount to revenue and order_ts to order_date.',
      },
      points: [
        {
          strong: 'Do impact analysis first.',
          text: 'Before you rename a column or change a type, query downstream tables and notify their owners.',
        },
        {
          strong: 'Trace a bad number upstream.',
          text: 'Walk table_lineage from the report table toward its sources to find where a value changed.',
        },
        {
          strong: 'Use the other system tables too.',
          text: 'system.lakeflow records job and pipeline runs, system.billing records cost, and system.access.audit records who did what.',
        },
      ],
      examples: [
        {
          label: 'Find what feeds a table',
          language: 'sql',
          code: "SELECT source_table_full_name, MAX(event_time) AS last_seen\nFROM system.access.table_lineage\nWHERE target_table_full_name = 'main.sales.gold_daily_revenue'\n  AND source_table_full_name IS NOT NULL\nGROUP BY source_table_full_name;",
        },
      ],
      links: [
        {
          label: 'Lineage system tables',
          url: 'https://docs.databricks.com/aws/en/admin/system-tables/lineage',
        },
        {
          label: 'View data lineage in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage',
        },
      ],
    },
    {
      id: 'schema',
      heading: 'Schema drift',
      prose:
        'Delta records every schema change in the table history. DESCRIBE HISTORY returns the operation, version, timestamp, and user for each one, so you can say what changed and who changed it. To watch many tables, snapshot information_schema.columns on a schedule and diff the snapshots.',
      table: {
        columns: ['Need', 'Use'],
        rows: [
          ['What changed on this table, and when', 'DESCRIBE HISTORY: ADD COLUMNS and CHANGE COLUMN entries'],
          ['Which tables changed anywhere in a schema', 'A scheduled diff of information_schema.columns snapshots'],
          [
            'New columns arriving in files',
            'Auto Loader schema evolution, or rescue mode to park them in _rescued_data',
          ],
          ['A source column widens, such as int to long', 'Delta type widening, so the table changes in place'],
          ['An unexpected change should stop a load', 'Schema enforcement, which rejects writes that do not match'],
        ],
      },
      examples: [
        {
          label: 'Read the schema changes on a table',
          language: 'sql',
          code: 'DESCRIBE HISTORY main.sales.silver_orders;\n\n-- Schema changes show as ADD COLUMNS, CHANGE COLUMN, REPLACE COLUMNS, or DROP COLUMNS in the operation column.',
          notes: ['From Python, spark.sql("DESCRIBE HISTORY ...") returns a DataFrame you can filter on operation.'],
        },
      ],
    },
    {
      id: 'data-drift',
      heading: 'Data drift and data quality monitoring',
      prose:
        'Data quality monitoring has two parts. Anomaly detection learns the usual freshness and completeness of each table in a schema and flags departures, with no per-table setup. Data profiling creates a monitor on a table that computes column statistics and drift metrics into Unity Catalog tables you can query, chart, and alert on.',
      points: [
        {
          strong: 'Create the monitor once and schedule it.',
          text: 'A cron schedule on the monitor refreshes its metrics tables. Do not recreate the monitor to refresh it.',
        },
        {
          strong: 'Compare against a baseline.',
          text: 'Drift metrics need a reference: the previous time window, or a baseline table of known-good data.',
        },
        {
          strong: 'Alert on the metrics tables.',
          text: 'A SQL alert on a drift metric notifies the table owner. Pick thresholds from a few weeks of history instead of a guess.',
        },
        {
          strong: 'Pair it with a simple statistic.',
          text: 'A population stability index on a key column is easy to explain to a business owner. A common rule treats PSI above 0.2 as a significant shift.',
        },
      ],
      options: {
        caption: 'Which data quality check to use',
        rows: [
          {
            option: 'Anomaly detection (Public Preview)',
            when: 'You want to know when any table in a schema goes stale or incomplete.',
            tradeoffs:
              'Learns the usual freshness and completeness of each table from history, with no per-table setup. It needs history to learn from, it covers freshness and completeness and not column values, and it is in Public Preview.',
          },
          {
            option: 'Data profiling',
            when: 'The values in specific tables matter, such as distribution drift against a baseline.',
            tradeoffs:
              'Computes column statistics, drift, and custom metrics into tables you can query and alert on. You create and schedule a monitor per table, which uses compute, and drift needs a baseline or a previous window.',
          },
          {
            option: 'Pipeline expectations',
            when: 'A row-level rule must be checked as data flows through a pipeline.',
            tradeoffs:
              'Checks each row at write time and can drop the row or stop the update. It covers only datasets in a pipeline, and not tables written elsewhere.',
          },
        ],
        recommendation:
          'Turn on anomaly detection for schemas first, because it needs no setup. Add data profiling to the tables whose values drive decisions, and keep expectations for row-level rules inside pipelines. They catch different failures and work together.',
      },
      examples: [
        {
          label: 'Create a data profiling monitor that refreshes on a schedule',
          language: 'py',
          code: 'from databricks.sdk import WorkspaceClient\nfrom databricks.sdk.service.dataquality import CronSchedule, DataProfilingConfig, Monitor, SnapshotConfig\n\nw = WorkspaceClient()\ntable = w.tables.get("main.sales.orders")\nschema = w.schemas.get("main.sales")\n\nw.data_quality.create_monitor(\n    monitor=Monitor(\n        object_type="table",\n        object_id=table.table_id,\n        data_profiling_config=DataProfilingConfig(\n            assets_dir="/Workspace/Shared/monitors/orders",\n            output_schema_id=schema.schema_id,\n            snapshot=SnapshotConfig(),\n            schedule=CronSchedule(quartz_cron_expression="0 0 6 * * ?", timezone_id="UTC"),\n        ),\n    )\n)',
          notes: [
            'Use a time series or inference profile instead of a snapshot when the table has a timestamp column.',
          ],
        },
      ],
      links: [
        {
          label: 'Data quality monitoring',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/',
        },
        {
          label: 'Anomaly detection',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/anomaly-detection/',
        },
        {
          label: 'Data profiling',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/',
        },
        {
          label: 'Manage data quality with pipeline expectations',
          url: 'https://docs.databricks.com/aws/en/ldp/expectations',
        },
      ],
    },
  ],
  related: [
    { slug: 'orchestration-patterns', title: 'Orchestration patterns' },
    { slug: 'monitoring', title: 'Platform observability' },
  ],
};
