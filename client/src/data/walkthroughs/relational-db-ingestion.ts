import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'relational-db-ingestion',
  area: 'Ingestion',
  title: 'Relational database extracts',
  intro:
    'A job builds a source in Lakebase Postgres, reads it through a Unity Catalog connection, and lands two full tables and one custom SQL result in Delta. A last task runs the same queries at the source and compares row counts, a checksum, and column types.',
  shortVersion: [
    {
      title: 'The source is a real Postgres.',
      body: 'The job creates schema source_app in the Lakebase project capability-guides with an OAuth token from the SDK: 200 customers, 1,000 orders, one SQL function.',
    },
    {
      title: 'One connection reaches it.',
      body: 'A Unity Catalog connection holds the endpoint and credentials. remote_query sends SQL through it.',
    },
    {
      title: 'Custom SQL runs at the source.',
      body: 'The join, the sum, the rank() window, and the net_amount() function all execute in Postgres. Only the 200-row result crosses the wire.',
    },
    {
      title: 'Landed rows are checked against the source.',
      body: 'Row counts and an md5-based checksum match for all three tables, and decimal(12,2) and date types are preserved.',
    },
    {
      title: 'Production CDC uses managed connectors.',
      body: 'Lakeflow Connect connectors for SQL Server, Oracle, and other databases replace this pattern when you need incremental change capture.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'From Postgres to Delta',
      prose:
        'Four tasks run in order. The first two prepare the source and the connection, the third extracts, and the fourth checks the result against the source.',
      diagram: {
        type: 'flow',
        title: 'The relational extract job',
        description:
          'create_source creates schema source_app, the tables customers and orders, and the function net_amount in Lakebase Postgres. setup_federation creates or refreshes a Unity Catalog connection with a fresh OAuth token. extract uses remote_query on the connection to land rel_customers, rel_orders, and rel_customer_revenue. compare_with_source runs the same queries directly in Postgres and compares counts, checksums, and types, then writes relational_extract_checks.',
        lanes: [
          { label: 'Lakeflow job tasks', fromRow: 0, toRow: 0 },
          { label: 'Systems and tables', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'create', label: 'create_source', mono: true, col: 0, row: 0 },
          { id: 'setup', label: 'setup_federation', mono: true, col: 1, row: 0 },
          { id: 'extract', label: 'extract', mono: true, sub: 'remote_query', col: 2, row: 0, kind: 'highlight' },
          { id: 'compare', label: 'compare_with_source', mono: true, col: 3, row: 0 },
          { id: 'pg', label: 'Lakebase Postgres', sub: 'schema source_app', col: 0, row: 1, kind: 'surface' },
          { id: 'conn', label: 'UC connection', sub: 'capability_guides_lakebase', col: 1, row: 1, kind: 'store' },
          { id: 'full', label: 'Full-table extracts', sub: 'rel_customers, rel_orders', col: 2, row: 1, kind: 'store' },
          { id: 'rev', label: 'rel_customer_revenue', mono: true, sub: 'custom SQL result', col: 2, row: 2, kind: 'store' },
          { id: 'checks', label: 'Checks table', sub: 'relational_extract_checks', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'create', to: 'setup' },
          { from: 'setup', to: 'extract' },
          { from: 'extract', to: 'compare' },
          { from: 'create', to: 'pg', label: 'DDL, rows' },
          { from: 'setup', to: 'conn' },
          { from: 'conn', to: 'pg', label: 'OAuth token' },
          { from: 'extract', to: 'full' },
          { from: 'extract', to: 'rev' },
          { from: 'compare', to: 'checks' },
        ],
        legend: [
          { kind: 'highlight', label: 'Federated read' },
          { kind: 'surface', label: 'External database' },
          { kind: 'store', label: 'Connection or table' },
        ],
      },
    },
    {
      id: 'query',
      heading: 'What runs at the source',
      prose:
        'The custom query is one string in relational_sql.py. remote_query ships it to Postgres, which executes every part of it.',
      diagram: {
        type: 'flow',
        title: 'Inside the custom query',
        description:
          'Postgres joins customers to orders and filters out cancelled orders. It calls net_amount on each order, sums the result per customer, and ranks customers within each country with a rank window function. The 200-row result is returned to Databricks and written to rel_customer_revenue.',
        nodes: [
          { id: 'join', label: 'JOIN', sub: 'customers to orders', col: 0, row: 0 },
          { id: 'filter', label: 'WHERE', sub: "status <> 'cancelled'", col: 1, row: 0 },
          { id: 'fn', label: 'net_amount()', mono: true, sub: 'database function', col: 2, row: 0, kind: 'highlight' },
          { id: 'agg', label: 'GROUP BY customer', sub: 'count and sum', col: 3, row: 0 },
          { id: 'win', label: 'rank() OVER', mono: true, sub: 'per country', col: 3, row: 1, kind: 'highlight' },
          { id: 'result', label: 'rel_customer_revenue', mono: true, sub: '200 rows', col: 2, row: 1, kind: 'store' },
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
    },
    {
      id: 'match',
      heading: 'Does it match the source',
      prose:
        'The compare task computes the same canonical row hash in Postgres SQL and in Spark SQL, sums it, and compares. It also checks the column types it expects to arrive.',
      diagram: {
        type: 'matrix',
        title: 'Landed tables against the source',
        description:
          'rel_customers: 200 source rows and 200 landed rows, checksum 417736062603 on both sides, types match. rel_orders: 1000 and 1000 rows, checksum 2133615031436 on both sides, types match. rel_customer_revenue: 200 and 200 rows, checksum 424026748417 on both sides, types match.',
        corner: 'Table ↓ · Measure →',
        columns: ['Source rows', 'Landed rows', 'Checksum', 'Types'],
        rows: [
          {
            label: 'rel_customers',
            sub: 'full table',
            cells: [
              { state: 'own', text: '200' },
              { state: 'own', text: '200' },
              { state: 'own', text: '417736062603' },
              { state: 'own', text: 'match' },
            ],
          },
          {
            label: 'rel_orders',
            sub: 'full table',
            cells: [
              { state: 'own', text: '1,000' },
              { state: 'own', text: '1,000' },
              { state: 'own', text: '2133615031436' },
              { state: 'own', text: 'match' },
            ],
          },
          {
            label: 'rel_customer_revenue',
            sub: 'custom SQL',
            cells: [
              { state: 'own', text: '200' },
              { state: 'own', text: '200' },
              { state: 'own', text: '424026748417' },
              { state: 'own', text: 'match' },
            ],
          },
        ],
        legend: [{ state: 'own', label: 'Same on both sides' }],
        caption: 'Source and landed checksums are equal in every row.',
      },
    },
    {
      id: 'production',
      heading: 'When to use something else',
      points: [
        {
          strong: 'Lakeflow Connect managed connectors.',
          text: 'For CDC from SQL Server, Oracle, PostgreSQL, MySQL, and others, a managed connector tracks changes and schema, applies updates and deletes, and needs no extract code. It is the production path.',
        },
        {
          strong: 'Foreign catalog.',
          text: 'With CREATE CATALOG on the metastore, a foreign catalog exposes the tables in Unity Catalog so you can query and join them in place. This workspace denied that privilege, so the job uses remote_query on the connection.',
        },
        {
          strong: 'Token lifetime.',
          text: 'The connection holds a Lakebase OAuth token that lasts about an hour. The job replaces it each run. Production uses a long-lived credential from a secret store.',
        },
      ],
    },
  ],
  related: [
    { slug: 'multi-source-pipeline', title: 'Multi-source pipeline' },
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
  ],
};
