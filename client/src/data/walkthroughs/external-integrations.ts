import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'external-integrations',
  area: 'General Guides',
  title: 'Partner tool integrations',
  intro:
    'Two connection patterns run end to end in one job. A Python client queries a SQL warehouse the way Power BI, Tableau, or a custom app would. Lakehouse Federation then reads an external Postgres database through a Unity Catalog connection. Both write their checks to the integration_checks table.',
  shortVersion: [
    {
      title: 'BI tools use one path.',
      body: 'The SQL Connector for Python takes a hostname, an HTTP path, and an OAuth identity. BI tools take the same three inputs.',
    },
    {
      title: 'The client matches Spark.',
      body: 'The warehouse returns 4 regions and 5,000 orders, equal to the Spark result. A named-parameter query returns 1,531 West orders.',
    },
    {
      title: 'Federation needs a connection.',
      body: 'A POSTGRESQL connection holds the host and credentials. A Lakebase Postgres project stands in for the external database.',
    },
    {
      title: 'Data stays in Postgres.',
      body: 'The job queries 200 Postgres rows in place, joins them with a Unity Catalog table, and runs an aggregate inside Postgres.',
    },
    {
      title: 'The foreign catalog was blocked.',
      body: 'CREATE CATALOG was not granted to the job identity, so the run used remote_query on the same connection.',
    },
  ],
  sections: [
    {
      id: 'patterns',
      heading: 'Two ways in',
      prose:
        'The first pattern is a client calling Databricks. The second is Databricks calling an outside system. The job runs them as two tasks after a shared data-prep task.',
      diagram: {
        type: 'flow',
        title: 'Client to warehouse, and Databricks to Postgres',
        description:
          'Task prepare_data creates the sharing_orders and sharing_products tables. Task sql_connector_client connects a Python client to a serverless SQL warehouse with the job identity and queries sharing_orders. Task lakehouse_federation seeds a table in a Lakebase Postgres database, creates a Unity Catalog connection to it, queries it through the connection, joins it with products, and drops the connection. Both tasks write to integration_checks.',
        lanes: [
          { label: 'Pattern A: SQL Connector', fromRow: 0, toRow: 0 },
          { label: 'Pattern B: Federation', fromRow: 1, toRow: 1 },
          { label: 'Evidence', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'client', label: 'Python client', sub: 'databricks-sql-connector', col: 0, row: 0, kind: 'highlight' },
          { id: 'warehouse', label: 'SQL warehouse', sub: 'serverless', col: 1, row: 0, kind: 'surface' },
          { id: 'orders', label: 'sharing_orders', mono: true, sub: '5,000 rows', col: 2, row: 0, kind: 'store' },
          { id: 'spark', label: 'Spark SQL', sub: 'job task', col: 0, row: 1 },
          { id: 'conn', label: 'UC connection', sub: 'POSTGRESQL', col: 1, row: 1, kind: 'surface' },
          { id: 'pg', label: 'Lakebase Postgres', sub: 'external_orders, 200 rows', col: 2, row: 1, kind: 'store' },
          { id: 'products', label: 'sharing_products', mono: true, sub: 'joined in Spark', col: 3, row: 1, kind: 'store' },
          { id: 'checks', label: 'integration_checks', mono: true, sub: 'one row per check', col: 1, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'client', to: 'warehouse', label: 'OAuth' },
          { from: 'warehouse', to: 'orders' },
          { from: 'spark', to: 'conn' },
          { from: 'conn', to: 'pg', label: 'password = token' },
          { from: 'pg', to: 'products', label: 'join', dashed: true },
          { from: 'client', to: 'checks' },
          { from: 'spark', to: 'checks' },
        ],
        legend: [
          { kind: 'highlight', label: 'External client' },
          { kind: 'surface', label: 'Connection point' },
          { kind: 'store', label: 'Data' },
        ],
      },
    },
    {
      id: 'connector',
      heading: 'Pattern A: the SQL Connector',
      prose:
        'The task logs the connection settings a BI tool would need, then runs two statements. The identity is the job identity in this run; an OAuth M2M service principal works by passing a client ID and secret.',
      steps: [
        {
          title: 'Connect',
          body: 'Hostname and HTTP path identify the warehouse. The credentials provider supplies the OAuth header.',
          code: 'sql.connect(server_hostname=host,\n  http_path="/sql/1.0/warehouses/<id>",\n  credentials_provider=lambda: cfg.authenticate)',
        },
        {
          title: 'Aggregate',
          body: 'GROUP BY region returns four rows totalling 5,000 orders. The task compares them with the same query run through Spark.',
        },
        {
          title: 'Parameterize',
          body: 'WHERE region = :region with a named parameter returns 1,531 rows, the number the Spark count expects.',
        },
      ],
    },
    {
      id: 'federation',
      heading: 'Pattern B: Lakehouse Federation',
      prose:
        'No external database is reachable from this workspace, so the job treats the Lakebase project as one. It seeds a table over a direct Postgres connection, then queries the same table through Unity Catalog.',
      diagram: {
        type: 'matrix',
        title: 'Federation checks and results',
        description:
          'Seed external source: 200 rows. Connection: created. Foreign catalog: blocked because CREATE CATALOG was not granted. Query external table: 200 rows with the same total as Postgres. Join with a Unity Catalog table: 200 rows across 3 products. Aggregate in Postgres: 4 region rows.',
        corner: 'Check ↓ · Result →',
        columns: ['Outcome', 'Result'],
        rows: [
          {
            label: 'Seed source',
            sub: 'direct Postgres connection',
            cells: [
              { state: 'own', text: 'Passed' },
              { state: 'own', text: '200 rows' },
            ],
          },
          {
            label: 'UC connection',
            sub: 'POSTGRESQL type',
            cells: [
              { state: 'own', text: 'Passed' },
              { state: 'own', text: 'created' },
            ],
          },
          {
            label: 'Foreign catalog',
            sub: 'needs CREATE CATALOG',
            cells: [
              { state: 'none', text: 'Blocked' },
              { state: 'none', text: 'remote_query used' },
            ],
          },
          {
            label: 'Query in place',
            sub: 'count and sum match',
            cells: [
              { state: 'own', text: 'Passed' },
              { state: 'own', text: '200 rows' },
            ],
          },
          {
            label: 'Join with UC table',
            sub: 'against sharing_products',
            cells: [
              { state: 'own', text: 'Passed' },
              { state: 'own', text: '3 products' },
            ],
          },
          {
            label: 'Aggregate in Postgres',
            sub: 'group by region',
            cells: [
              { state: 'own', text: 'Passed' },
              { state: 'own', text: '4 rows' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Check passed' },
          { state: 'none', label: 'Blocked by a missing privilege' },
        ],
        caption: 'The connection is dropped at the end of the run, so no credential stays behind.',
      },
    },
    {
      id: 'identity',
      heading: 'Identity and connectivity',
      prose: 'Each pattern authenticates differently, and neither stores a long-lived secret in the bundle.',
      table: {
        columns: ['Pattern', 'Identity and path'],
        rows: [
          ['SQL Connector', 'job identity OAuth token over HTTPS to /sql/1.0/warehouses/<id>'],
          ['SQL Connector, app', 'OAuth M2M service principal via --client-id and --client-secret'],
          ['Federation', 'Lakebase OAuth token as the Postgres password, sslmode require'],
          ['Token lifetime', 'one hour for the Lakebase token, so the connection is short-lived'],
          ['Cleanup', 'connection and any foreign catalog dropped in a finally block'],
        ],
      },
    },
  ],
  related: [
    { slug: 'iceberg-support', title: 'Apache Iceberg interoperability' },
    { slug: 'relational-db-ingestion', title: 'Relational database extracts' },
  ],
};
