import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'local-tool-connectivity',
  area: 'Analyst Guides',
  title: 'Connecting local tools',
  intro:
    'Python, R, SAS, and SPSS reach the same SQL warehouse through the Databricks SQL connector, Databricks Connect, ODBC, or JDBC. Each client signs in with OAuth and sees only what Unity Catalog grants that identity. The job runs the Python connector path against the warehouse and records the result.',
  shortVersion: [
    {
      title: 'One endpoint, several clients.',
      body: 'All clients use the warehouse HTTP path. Only the driver and the language differ.',
    },
    {
      title: 'OAuth replaces passwords.',
      body: 'Users sign in through the browser (U2M). Scheduled or shared tools use a service principal (M2M).',
    },
    {
      title: 'Copy-paste examples ship in the bundle.',
      body: 'examples/ holds Python, Databricks Connect, R odbc, R JDBC, an odbc.ini, a JDBC URL, and SAS and SPSS notes.',
    },
    {
      title: 'The job runs the connector.',
      body: 'Run 335256858614154 connected as the job identity, counted 5,000 customers across 4 regions, and took 1.56 s.',
    },
    {
      title: 'Permissions follow the identity.',
      body: 'A local client sees the tables its signed-in user or service principal can read, and no others.',
    },
  ],
  sections: [
    {
      id: 'paths',
      heading: 'Which client for which tool',
      prose: 'Pick the client by language and tool. Every row ends at the same warehouse and the same Unity Catalog permissions.',
      diagram: {
        type: 'matrix',
        title: 'Clients, drivers, and sign-in',
        description:
          'Python uses the Databricks SQL connector or Databricks Connect with OAuth U2M or M2M. R uses odbc or RJDBC with the Databricks ODBC or JDBC driver. SAS uses SAS/ACCESS with ODBC or JDBC. SPSS uses the Database Wizard with ODBC or JDBC.',
        corner: 'Tool ↓ · Detail →',
        columns: ['Driver', 'Compute', 'Sign-in'],
        rows: [
          { label: 'Python', sub: 'pandas, scripts', cells: [{ state: 'own', text: 'SQL connector' }, { state: 'own', text: 'SQL warehouse' }, { state: 'own', text: 'U2M or M2M' }] },
          { label: 'Python (Spark API)', sub: 'DataFrame code', cells: [{ state: 'own', text: 'Databricks Connect' }, { state: 'own', text: 'Serverless' }, { state: 'own', text: 'U2M or M2M' }] },
          { label: 'R', sub: 'DBI, dplyr', cells: [{ state: 'own', text: 'odbc or RJDBC' }, { state: 'own', text: 'SQL warehouse' }, { state: 'own', text: 'U2M or M2M' }] },
          { label: 'SAS', sub: 'SAS/ACCESS', cells: [{ state: 'own', text: 'ODBC or JDBC' }, { state: 'own', text: 'SQL warehouse' }, { state: 'optional', text: 'M2M for batch' }] },
          { label: 'SPSS', sub: 'Database Wizard', cells: [{ state: 'own', text: 'ODBC or JDBC' }, { state: 'own', text: 'SQL warehouse' }, { state: 'optional', text: 'U2M for desktop' }] },
        ],
        legend: [
          { state: 'own', label: 'Standard path' },
          { state: 'optional', label: 'Usual choice, not required' },
        ],
      },
    },
    {
      id: 'oauth',
      heading: 'How OAuth reaches the warehouse',
      prose:
        'U2M opens a browser once and caches a token. M2M exchanges a service principal ID and secret for a token. Either way the client sends the token to the warehouse, which checks Unity Catalog grants for that identity.',
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
          { id: 'tool', label: 'Local client', sub: 'Python, R, SAS, SPSS', col: 0, row: 0 },
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
    },
    {
      id: 'job',
      heading: 'What the job runs',
      prose:
        'sql_connector_check uses the same code a laptop would. With DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET set it signs in with M2M. In a job without them it uses the job identity. The reference run used the job identity.',
      diagram: {
        type: 'flow',
        title: 'Connector check task',
        description:
          'generate_data writes customers. sql_connector_check builds a Databricks SDK Config, opens a SQL connector connection to the warehouse, selects current_user and a count by region, and writes one row to connectivity_check. The task fails if the connector returns no rows.',
        nodes: [
          { id: 'gen', label: 'generate_data', mono: true, col: 0, row: 0 },
          { id: 'cfg', label: 'Config()', mono: true, sub: 'job identity or M2M', col: 1, row: 0 },
          { id: 'conn', label: 'sql.connect()', mono: true, sub: 'warehouse HTTP path', col: 2, row: 0, kind: 'highlight' },
          { id: 'q', label: 'SELECT ... GROUP BY', sub: 'customers by region', col: 3, row: 0 },
          { id: 'rec', label: 'connectivity_check', mono: true, sub: 'auth mode, rows, seconds', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'gen', to: 'cfg' },
          { from: 'cfg', to: 'conn' },
          { from: 'conn', to: 'q' },
          { from: 'q', to: 'rec' },
        ],
        legend: [
          { kind: 'highlight', label: 'Databricks SQL connector' },
          { kind: 'store', label: 'Recorded result' },
        ],
        caption: 'Recorded: job-identity, connected as the run user, 4 groups, 5,000 customers, 1.56 s.',
      },
    },
    {
      id: 'examples',
      heading: 'Copy-paste examples',
      points: [
        { strong: 'python_sql_connector.py', text: 'sql.connect with credentials_provider=lambda: cfg.authenticate. Works for U2M and M2M.' },
        { strong: 'databricks_connect.py', text: 'DatabricksSession.builder.serverless(True) for DataFrame code that runs on serverless compute.' },
        { strong: 'r_odbc.R and r_jdbc.R', text: 'DBI with odbc::databricks(), or RJDBC with the Databricks JDBC jar.' },
        { strong: 'odbc.ini.example and jdbc_url.txt', text: 'Data source and URL settings for SAS, SPSS, and other desktop tools.' },
        { strong: 'sas_spss.md', text: 'A libname statement for SAS and the Database Wizard steps for SPSS.' },
      ],
    },
  ],
  related: [
    { slug: 'sql-notebook-analysis', title: 'SQL and notebooks at scale' },
    { slug: 'self-service-extracts', title: 'Self-service extracts and subscriptions' },
  ],
};
