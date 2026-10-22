import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'relational-db-ingestion',
  area: 'Ingestion',
  title: 'Relational database extracts',
  intro:
    'Databricks has three ways to bring a relational database into Delta: Lakehouse Federation to query it in place, Lakeflow Connect change data capture (CDC) connectors for continuous replication, and query-based connectors for scheduled incremental pulls. This page helps you choose between them, shows how pushdown works for custom SQL, and covers how to verify that what landed matches the source.',
  businessValue: {
    summary:
      'Three options bring operational database data into the lakehouse, from live queries to continuous replication. Data owners match freshness and source load to the need instead of copying everything the same way.',
    outcomes: [
      {
        title: 'Query before you build',
        body: 'A Unity Catalog connection and foreign catalog let analysts query and join source tables with Delta tables right away, with no pipeline. Materialize the data if dashboards read it often.',
      },
      {
        title: 'Protect the production database',
        body: 'CDC connectors read the transaction log, which puts the least load on the source. Federation queries hit the source every time, so heavy use loads it.',
      },
      {
        title: 'Match cost to freshness',
        body: "Query-based connectors poll on a schedule and need no CDC setup on the source. Check each connector's release stage before committing a production plan.",
      },
      {
        title: 'Proof the copy is right',
        body: 'Row counts, a checksum, and column types compared against the source show whether what landed matches what the source holds.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Choose by freshness, volume, and source load.',
      body: 'Federation reads live data with no copy. CDC connectors replicate changes with the lowest source load. Query-based connectors poll on a schedule and need no CDC setup on the source.',
    },
    {
      title: 'Federation is for querying in place.',
      body: 'A Unity Catalog connection and a foreign catalog expose source tables to SQL. Use it for ad hoc analysis, joins with Delta tables, and one-time loads. Materialize the data if dashboards or models read it often.',
    },
    {
      title: 'CDC connectors are for production replication.',
      body: 'Managed connectors for SQL Server, PostgreSQL, MySQL, and Oracle track inserts, updates, and deletes from the transaction log and apply them to streaming tables. Check each connector’s release stage.',
    },
    {
      title: 'Query-based connectors fill the gap.',
      body: 'A cursor column such as an updated-at timestamp drives incremental pulls. They support more sources than CDC but see only the latest state of each row between runs.',
    },
    {
      title: 'Verify the load.',
      body: 'Compare row counts, a checksum, and column types against the source, and push joins and aggregates down to the database so only results cross the wire.',
    },
  ],
  sections: [
    {
      id: 'decision',
      heading: 'Choose the ingestion path',
      options: {
        caption: 'Three ways to ingest a relational database',
        rows: [
          {
            option: 'Lakehouse Federation',
            when: 'Explore a table, join source data with Delta tables, load once with CREATE TABLE AS SELECT, or push a custom join or aggregate to the source (foreign catalog pushdown or remote_query).',
            tradeoffs:
              'Live data per query, with no copy and no setup on the source beyond a connection and grants. Every query hits the source, so performance and source load depend on the source system and on how much work is pushed down. Heavy or repeated use belongs in ingestion instead.',
          },
          {
            option: 'Lakeflow Connect CDC connector',
            when: 'Keep a table in sync with inserts, updates, and deletes, with minimal source load.',
            tradeoffs:
              'Reads the transaction log, so it puts the lowest load on the source, and freshness is continuous or scheduled. You enable CDC or logging on the source, may need a gateway on classic compute depending on the connector, and should check the release stage of each connector.',
          },
          {
            option: 'Query-based connector',
            when: 'The database or its CDC feature is not supported, or you cannot enable CDC. It needs a reliable cursor column.',
            tradeoffs:
              'No gateway and no CDC setup, and it runs on serverless compute. Each run queries the source tables, so load is higher than log reading. It captures the latest state of each changed row, not every intermediate state. Hard deletes need extra configuration.',
          },
        ],
        recommendation:
          'Use a Lakeflow Connect CDC connector for tables people read often and that must track deletes. Use a query-based connector when CDC is unavailable and a cursor column exists. Use Federation for exploration, one-time loads, and small or rarely read tables.',
      },
      links: [
        {
          label: 'Managed database connectors (CDC)',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/cdc-overview',
        },
        {
          label: 'Query-based connectors',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/query-based-overview',
        },
        { label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' },
      ],
    },
    {
      id: 'connectors',
      heading: 'Which databases each path supports',
      points: [
        {
          strong: 'Lakeflow Connect CDC connectors.',
          text: 'The managed database connectors list MySQL, PostgreSQL, Microsoft SQL Server, and Oracle (through LogMiner). A gateway on classic compute captures the change log, and a serverless pipeline applies it. Check the release stage of each connector in the docs before you commit to one.',
        },
        {
          strong: 'Query-based connectors.',
          text: 'With a Unity Catalog connection: Oracle, Teradata, SQL Server, MySQL, MariaDB, and PostgreSQL. With a foreign catalog, any Lakehouse Federation source. They run on serverless compute by default and support SCD type 1, SCD type 2, and append-only modes.',
        },
        {
          strong: 'Lakehouse Federation.',
          text: 'Supports many sources, including major relational databases and warehouses. See the Lakehouse Federation page for the current list.',
        },
        {
          strong: 'Cursor column rules.',
          text: 'A query-based connector needs a monotonically increasing timestamp or integer that changes whenever a row changes. Hard deletes need extra configuration, and soft deletes can use a deletion condition.',
        },
      ],
    },
    {
      id: 'query',
      heading: 'Push custom SQL to the source',
      prose:
        'With Federation, remote_query sends a SQL string to the database and returns only the result. Joins, aggregates, window functions, and database functions then run where the data lives, and a small result crosses the wire.',
      diagram: {
        type: 'flow',
        title: 'Pushdown with remote_query',
        description:
          'Databricks sends the query text over the Unity Catalog connection. The database joins tables, filters rows, calls its own functions, aggregates, and applies window functions. Only the result set returns to Databricks and is written to a Delta table.',
        nodes: [
          {
            id: 'join',
            label: 'JOIN',
            sub: 'tables in the source',
            col: 0,
            row: 0,
            icon: 'gear-navy',
            domain: 'neutral',
            detail: 'The query text joins source tables inside the database, so the join runs where the data lives.',
          },
          {
            id: 'filter',
            label: 'WHERE',
            sub: 'filter at the source',
            col: 1,
            row: 0,
            icon: 'gear-navy',
            domain: 'neutral',
            detail: 'A WHERE clause filters rows at the source, so unneeded rows never cross the wire.',
          },
          {
            id: 'fn',
            label: 'Database function',
            sub: 'runs in the database',
            col: 2,
            row: 0,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'neutral',
            detail:
              'Database functions run inside the database, which is why remote_query takes a query written in the source dialect.',
          },
          {
            id: 'agg',
            label: 'GROUP BY',
            sub: 'count and sum',
            col: 3,
            row: 0,
            icon: 'gear-navy',
            domain: 'neutral',
            detail: 'Counts and sums run at the source, so only the aggregated rows travel to Databricks.',
          },
          {
            id: 'win',
            label: 'Window function',
            sub: 'rank, running total',
            col: 3,
            row: 1,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'neutral',
            detail:
              'Window functions such as rank and running total also run in the database, so only a small result crosses the wire.',
          },
          {
            id: 'result',
            label: 'Delta table',
            sub: 'result only',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Only the result set returns to Databricks and is written to a Delta table, for example with CREATE OR REPLACE TABLE AS SELECT.',
          },
        ],
        edges: [
          { from: 'join', to: 'filter' },
          { from: 'filter', to: 'fn' },
          { from: 'fn', to: 'agg' },
          { from: 'agg', to: 'win' },
          { from: 'win', to: 'result', label: 'result only' },
        ],
        legend: [
          { kind: 'highlight', label: 'Database function and window' },
          { kind: 'store', label: 'Delta table' },
        ],
      },
      examples: [
        {
          label: 'Pushdown query landed as a table',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE main.bronze.customer_revenue AS
SELECT * FROM remote_query(
  'sales_pg',
  query => 'SELECT c.customer_id, c.country,
                   sum(net_amount(o.amount, o.discount)) AS revenue,
                   rank() OVER (PARTITION BY c.country ORDER BY sum(net_amount(o.amount, o.discount)) DESC) AS country_rank
            FROM customers c JOIN orders o USING (customer_id)
            WHERE o.status <> ''cancelled''
            GROUP BY c.customer_id, c.country'
);`,
          notes: [
            'Query the source through a foreign catalog when you want tables, not strings; Databricks pushes down filters and aggregates it can.',
            'Keep credentials in the connection. Use a long-lived credential or OAuth setup that suits the database, not a short-lived token pasted into the connection.',
          ],
        },
      ],
      options: {
        caption: 'How to run work at the source',
        rows: [
          {
            option: 'remote_query with a SQL string',
            when: 'The logic needs source-specific features: database functions, window functions, or a join best done where the data lives.',
            tradeoffs:
              'Joins, aggregates, and functions run in the database and only the result crosses the wire. The query is written in the source dialect, so it is tied to that database, and the string is not checked until it runs.',
          },
          {
            option: 'Query a foreign catalog',
            when: 'Simple filters and aggregates over source tables, with tables you can browse and govern in Unity Catalog.',
            tradeoffs:
              'Portable SQL with Unity Catalog permissions on top, and Databricks pushes down the filters and aggregates it can. You do not control what is pushed down, so a complex query may pull more rows than expected.',
          },
          {
            option: 'Query-based connector over a query',
            when: 'The result must land incrementally on a schedule rather than be recomputed on every run.',
            tradeoffs:
              'Loads only changed rows using a cursor column and keeps a Delta table current. It needs a reliable cursor, and each run still queries the source.',
          },
        ],
        recommendation:
          'Use remote_query when the source can do the heavy part of the work, and a foreign catalog for simple reads. Switch to a query-based pipeline when the result must refresh incrementally.',
      },
      links: [
        {
          label: 'Query external databases using remote_query',
          url: 'https://docs.databricks.com/aws/en/query-federation/remote-queries',
        },
      ],
    },
    {
      id: 'match',
      heading: 'Verify the landed data',
      prose:
        'Compare the landed table with the source before anyone depends on it. Run the same measures on both sides.',
      points: [
        {
          strong: 'Row counts.',
          text: 'Count rows at the source and in Delta for the same cut-off, such as a snapshot time or a cursor value.',
        },
        {
          strong: 'Checksum.',
          text: 'Compute a hash over a canonical form of each row (fixed column order, explicit casts, null handling) in both engines, sum it, and compare. A count match can hide changed values.',
        },
        {
          strong: 'Types.',
          text: 'Check precision and scale for decimals, time zone handling for timestamps, and date types. Mapping differences are the usual cause of silent drift.',
        },
        {
          strong: 'Keep the check.',
          text: 'Run the comparison on a schedule for CDC and query-based tables, and alert on a mismatch.',
        },
      ],
    },
  ],
  related: [
    { slug: 'sqlserver-lakeflow-connect', title: 'SQL Server connections with Lakeflow Connect' },
    { slug: 'multi-source-pipeline', title: 'Multi-source pipeline' },
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
  ],
};
