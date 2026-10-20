import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'local-tool-connectivity',
  area: 'Analyst Guides',
  title: 'Connecting local tools',
  intro:
    'Analysts work in Excel, Power BI, Tableau, Python, R, SAS, and SPSS. All of them can reach the same serverless SQL warehouse, sign in with OAuth, and see only what Unity Catalog grants their identity. This page covers which client to use for each tool, how to authenticate without passwords or personal access tokens, and how to size the warehouse for BI.',
  shortVersion: [
    {
      title: 'One endpoint: a serverless SQL warehouse.',
      body: 'Every client uses the same warehouse HTTP path. Only the driver and the tool differ.',
    },
    {
      title: 'Use the native connector for each tool.',
      body: 'The Excel Add-in (GA), Power BI, and Tableau connect with OAuth. Python, R, SAS, and SPSS use the SQL connector, ODBC, or JDBC.',
    },
    {
      title: 'OAuth replaces passwords and tokens.',
      body: 'People sign in through the browser (U2M). Scheduled or shared tools use a service principal (M2M). Do not put a personal access token in a shared tool.',
    },
    {
      title: 'Use Databricks Connect on serverless for developers.',
      body: 'Developers who write Spark code in an IDE connect with Databricks Connect, and need no cluster to manage.',
    },
    {
      title: 'Permissions follow the identity.',
      body: 'A local client sees the tables its signed-in user or service principal can read, and no others. Size the warehouse for the BI crowd, and restrict network access as policy requires.',
    },
  ],
  sections: [
    {
      id: 'paths',
      heading: 'Which client for which tool',
      prose: 'Pick the client by tool. Every row ends at the same warehouse and the same Unity Catalog permissions.',
      diagram: {
        type: 'matrix',
        title: 'Tools, clients, and sign-in',
        description:
          'Excel uses the Databricks Excel Add-in with OAuth. Power BI and Tableau use their Databricks connectors with OAuth, and Power BI can also use a service principal. Python uses the SQL connector or Databricks Connect. R uses odbc. SAS and SPSS use ODBC or JDBC.',
        corner: 'Tool ↓ · Detail →',
        columns: ['Client', 'Compute', 'Sign-in'],
        rows: [
          { label: 'Excel', sub: 'pivot, SQL, write back', cells: [{ state: 'own', text: 'Excel Add-in (GA)' }, { state: 'own', text: 'SQL warehouse' }, { state: 'own', text: 'OAuth U2M' }] },
          { label: 'Power BI', sub: 'reports, semantic models', cells: [{ state: 'own', text: 'Databricks connector' }, { state: 'own', text: 'SQL warehouse' }, { state: 'own', text: 'OAuth U2M or M2M' }] },
          { label: 'Tableau', sub: 'Desktop, Cloud', cells: [{ state: 'own', text: 'Databricks connector' }, { state: 'own', text: 'SQL warehouse' }, { state: 'own', text: 'OAuth' }] },
          { label: 'Python', sub: 'pandas, scripts', cells: [{ state: 'own', text: 'SQL connector' }, { state: 'own', text: 'SQL warehouse' }, { state: 'own', text: 'U2M or M2M' }] },
          { label: 'Python (Spark API)', sub: 'DataFrame code', cells: [{ state: 'own', text: 'Databricks Connect' }, { state: 'own', text: 'Serverless' }, { state: 'own', text: 'U2M or M2M' }] },
          { label: 'R', sub: 'DBI, dplyr', cells: [{ state: 'own', text: 'odbc or RJDBC' }, { state: 'own', text: 'SQL warehouse' }, { state: 'own', text: 'U2M or M2M' }] },
          { label: 'SAS and SPSS', sub: 'SAS/ACCESS, Database Wizard', cells: [{ state: 'own', text: 'ODBC or JDBC' }, { state: 'own', text: 'SQL warehouse' }, { state: 'optional', text: 'M2M for batch' }] },
        ],
        legend: [
          { state: 'own', label: 'Recommended path' },
          { state: 'optional', label: 'Usual choice, not required' },
        ],
      },
      links: [
        {
          label: 'Databricks Excel Add-in',
          url: 'https://docs.databricks.com/aws/en/integrations/excel/',
        },
        {
          label: 'Connect Power BI',
          url: 'https://docs.databricks.com/aws/en/partners/bi/power-bi',
        },
        {
          label: 'Connect Tableau',
          url: 'https://docs.databricks.com/aws/en/partners/bi/tableau',
        },
      ],
    },
    {
      id: 'oauth',
      heading: 'How OAuth reaches the warehouse',
      prose:
        'U2M opens a browser once and caches a token. M2M exchanges a service principal ID and secret for a token. If your identity provider already issues tokens, OAuth token federation exchanges them for Databricks tokens, so no secret is stored on the client. Either way the client sends the token to the warehouse, which checks Unity Catalog grants for that identity.',
      diagram: {
        type: 'flow',
        title: 'Token and query path',
        description:
          'A local client asks the workspace OAuth endpoint for a token, using a browser sign-in for a user or a client ID and secret for a service principal. It sends the token and a SQL statement to the SQL warehouse. The warehouse checks Unity Catalog privileges for the identity and returns rows.',
        lanes: [
          { label: 'Your machine', fromRow: 0, toRow: 0 },
          { label: 'Workspace', fromRow: 1, toRow: 1 },
        ],
        nodes: [
          { id: 'tool', label: 'Local client', sub: 'Excel, BI, Python, R', col: 0, row: 0 },
          { id: 'u2m', label: 'Browser sign-in', sub: 'OAuth U2M', col: 1, row: 0 },
          { id: 'm2m', label: 'Client ID and secret', sub: 'OAuth M2M', col: 2, row: 0 },
          { id: 'token', label: 'Workspace OAuth', sub: 'issues a token', col: 1, row: 1, kind: 'highlight' },
          { id: 'wh', label: 'SQL warehouse', sub: 'runs the statement', col: 2, row: 1 },
          { id: 'uc', label: 'Unity Catalog', sub: 'checks privileges', col: 3, row: 1, kind: 'gate' },
        ],
        edges: [
          { from: 'tool', to: 'u2m' },
          { from: 'tool', to: 'm2m', dashed: true },
          { from: 'u2m', to: 'token' },
          { from: 'm2m', to: 'token' },
          { from: 'token', to: 'wh', label: 'bearer token' },
          { from: 'wh', to: 'uc' },
        ],
        legend: [
          { kind: 'highlight', label: 'Token issuer' },
          { kind: 'gate', label: 'Same grants as the workspace' },
          { kind: 'dashed', label: 'Automation path' },
        ],
      },
      examples: [
        {
          label: 'Sign in from a terminal',
          language: 'sh',
          code: '# U2M: opens a browser once and caches a token\ndatabricks auth login --host https://<workspace-host>\n\n# M2M: a service principal\'s OAuth secret\nexport DATABRICKS_HOST=https://<workspace-host>\nexport DATABRICKS_CLIENT_ID=<application-id>\nexport DATABRICKS_CLIENT_SECRET=<oauth-secret>',
          notes: ['The SQL connector, Databricks Connect, and odbc::databricks() all read these settings.'],
        },
      ],
      links: [
        {
          label: 'Authorize access with OAuth',
          url: 'https://docs.databricks.com/aws/en/dev-tools/auth/',
        },
      ],
    },
    {
      id: 'warehouse',
      heading: 'Size the warehouse for BI',
      points: [
        {
          strong: 'Use a serverless SQL warehouse.',
          text: 'It starts in seconds, so interactive tools do not wait for a cold cluster, and it scales with the number of users.',
        },
        {
          strong: 'Give BI its own warehouse.',
          text: 'Separating dashboards and ad hoc work from ETL keeps a heavy job from slowing a report. Tag the warehouse for cost attribution.',
        },
        {
          strong: 'Scale clusters for concurrency.',
          text: 'Set a minimum and maximum cluster count. Queries queue when all clusters are busy, so raise the maximum if reports wait.',
        },
        {
          strong: 'Control the network.',
          text: 'Use IP access lists or private connectivity if local clients must connect only from approved networks.',
        },
      ],
      links: [
        {
          label: 'SQL warehouses',
          url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/',
        },
      ],
    },
    {
      id: 'examples',
      heading: 'Developer and statistics tools',
      points: [
        { strong: 'Python SQL connector.', text: 'sql.connect with credentials_provider=lambda: cfg.authenticate works for U2M and M2M.' },
        { strong: 'Databricks Connect.', text: 'DatabricksSession.builder.serverless(True) runs DataFrame code on serverless compute from your IDE.' },
        { strong: 'R.', text: 'DBI with odbc::databricks() reads tables on the warehouse. For Spark work from R, use sparklyr through Databricks Connect.' },
        { strong: 'SAS, SPSS, and other desktop tools.', text: 'Configure the Databricks ODBC or JDBC driver with the warehouse host and HTTP path, and sign in with OAuth.' },
      ],
      links: [
        {
          label: 'Databricks SQL connector for Python',
          url: 'https://docs.databricks.com/aws/en/dev-tools/python-sql-connector',
        },
        {
          label: 'Databricks Connect',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/',
        },
        {
          label: 'Databricks ODBC driver',
          url: 'https://docs.databricks.com/aws/en/integrations/odbc/',
        },
      ],
    },
  ],
  related: [
    { slug: 'sql-notebook-analysis', title: 'SQL and notebooks at scale' },
    { slug: 'self-service-extracts', title: 'Self-service extracts and subscriptions' },
  ],
};
