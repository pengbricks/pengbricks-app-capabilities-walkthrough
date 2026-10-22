import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'lakebase-apps',
  area: 'General Guides',
  title: 'App development with Lakebase',
  intro:
    'A Databricks App that reads and writes single rows needs a transactional database, and Lakebase is managed Postgres on the platform for that. You still make several choices. You decide whether the app needs Lakebase at all, how it signs in and pools connections, how lakehouse tables reach it, how its own writes reach Delta, and how branches serve dev and test. This page covers the platform model, the app database resource, OAuth tokens and pooling, identity, scale to zero, synced tables, write-back, Unity Catalog registration, branches, bundles, and pgvector.',
  businessValue: {
    summary:
      'Teams building internal apps and agents need a database that handles row-level reads and writes without a separate stack. Lakebase gives the app Postgres next to governed lakehouse data, so the app stays fast and analytics stays current.',
    outcomes: [
      {
        title: 'Fast app responses',
        body: 'Postgres serves single-row reads and writes with low latency. The app no longer waits on a SQL warehouse for each page load, and warehouses stay free for analytical queries.',
      },
      {
        title: 'Lakehouse data in the app',
        body: 'Synced tables copy curated Unity Catalog tables into Lakebase and keep them updated. Developers write no sync scripts, and the app reads scores, features, and customer records at low latency.',
      },
      {
        title: 'App activity reaches analytics',
        body: 'Change Data Feed (Public Preview) stores app writes as Delta history tables. Analysts and pipelines get an audit trail and a source for reports without a separate capture tool.',
      },
      {
        title: 'Cheaper, safer testing',
        body: 'A branch is a copy of production data that exists in seconds. Branches that expire cost only the data you change, and idle dev compute suspends to zero.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Use Lakebase for row-level app work.',
      body: 'Keep analytical queries on a SQL warehouse. Put app state in Lakebase, and sync curated lakehouse tables into it for fast lookups.',
    },
    {
      title: 'Build on the current platform.',
      body: 'Projects, branches, and endpoints replace Provisioned instances. You cannot create new Provisioned databases, and existing ones were upgraded by July 2026.',
    },
    {
      title: 'Add the database as an app resource.',
      body: 'Databricks creates a Postgres role named after the app service principal and sets the PG environment variables.',
    },
    {
      title: 'Mint a fresh OAuth token for every new connection.',
      body: 'Tokens last one hour and are checked at login. A psycopg pool that fetches a token per connection handles it. Use a password role only when you need PgBouncer.',
    },
    {
      title: 'Expect the first query after idle to be slow and to lose session state.',
      body: 'Scale to zero suspends compute. Give the app retries and a connection check, and turn scale to zero off where latency matters.',
    },
    {
      title: 'Pick a sync mode by how fresh the data must be.',
      body: 'Snapshot for bulk refreshes, Triggered for a known cadence, Continuous only for near-real-time reads.',
    },
    {
      title: 'Send app writes back with Change Data Feed.',
      body: 'It is in Public Preview and works per schema with REPLICA IDENTITY FULL. Give dev and test branches an expiration, and define the project in a bundle.',
    },
  ],
  prerequisites: [
    {
      slug: 'databricks-apps',
      title: 'Databricks Apps, App Spaces and Serverless Micro Apps',
      why: 'The app resource and the app and user authorization models come from there. This page covers only what changes when the resource is a Lakebase database.',
    },
    {
      slug: 'unity-catalog-basics',
      title: 'Unity Catalog basics',
      why: 'Synced tables, Change Data Feed destinations, and catalog registration all depend on catalogs, schemas, and the grants on them.',
    },
  ],
  sections: [
    {
      id: 'when-lakebase',
      heading: 'Lakebase or a SQL warehouse',
      prose:
        'Both can sit behind an app. They are built for different queries. Lakebase is an operational (OLTP) Postgres database for low-latency reads and writes of individual rows. A SQL warehouse is built for analytical (OLAP) queries over large Delta tables. Many apps need both, and the usual split keeps app state in Lakebase and syncs curated lakehouse data into it.',
      options: {
        caption: 'Where the app reads and writes',
        rows: [
          {
            option: 'Lakebase (Postgres)',
            when: 'The app inserts, updates, and looks up individual rows, needs transactions, or serves many small concurrent requests.',
            tradeoffs:
              'Low latency and ACID transactions with standard Postgres drivers. You manage connections and token refresh, and data that analysts need must be sent back to Delta. Compute bills while active and suspends to zero if you allow it.',
          },
          {
            option: 'SQL warehouse over Delta',
            when: 'The app runs aggregations, scans, or dashboards over large lakehouse tables, and a second or more per query is acceptable.',
            tradeoffs:
              'No second database and no sync. A warehouse is not tuned for many single-row writes, a serverless warehouse can need a start-up wait, and each request occupies warehouse capacity.',
          },
          {
            option: 'Lakebase plus synced tables',
            when: 'The app needs lakehouse output such as scores, features, or customer profiles at lookup speed, next to its own state.',
            tradeoffs:
              'Fast reads of curated data and no per-request warehouse call. You run two stores, pay for the sync pipeline and the copy, and accept the freshness of the sync mode you choose.',
          },
        ],
        recommendation:
          'Start from the access pattern. Row-level reads and writes go to Lakebase, large analytical scans stay on a warehouse, and an app that does both uses Lakebase with synced tables. Do not point a transactional write path at a warehouse.',
      },
      links: [
        { label: 'Lakebase use cases', url: 'https://docs.databricks.com/aws/en/oltp/projects/use-cases' },
        {
          label: 'Build applications on Lakebase',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/build-applications',
        },
      ],
    },
    {
      id: 'overview',
      heading: 'How the pieces fit',
      prose:
        'The app talks to one Lakebase branch. The production branch holds the app-owned tables the app writes and the synced tables that copy lakehouse data in. Change Data Feed carries app-owned tables back to Delta, and a dev branch shares the same storage until you change it.',
      diagram: {
        type: 'flow',
        title: 'An app on Lakebase, with data moving both ways',
        description:
          'Users call a Databricks App. The app reads and writes app-owned tables and reads synced tables in a Lakebase production branch. A sync pipeline copies a Unity Catalog Delta table into the synced tables. Change Data Feed copies app-owned table changes into Delta history tables. A dev branch is created from the production branch.',
        nodes: [
          {
            id: 'users',
            label: 'Users',
            sub: 'browser or API',
            col: 0,
            row: 1,
            kind: 'surface',
            icon: 'users',
            domain: 'apps',
            detail: 'People or services that call the app over HTTPS. They never connect to Postgres directly.',
          },
          {
            id: 'app',
            label: 'Databricks App',
            sub: 'service principal',
            col: 1,
            row: 1,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'apps',
            detail:
              'Runs as its own service principal. The database resource gives it a Postgres role and the PG environment variables, and its pool mints OAuth tokens.',
          },
          {
            id: 'apptbl',
            label: 'App-owned tables',
            sub: 'orders, sessions',
            col: 2,
            row: 0,
            kind: 'store',
            icon: 'cloud-database',
            domain: 'data',
            detail:
              'Ordinary Postgres tables the app creates and writes in the production branch. The app role owns them, and Change Data Feed can capture them.',
          },
          {
            id: 'synced',
            label: 'Synced tables',
            sub: 'read-only copies',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'cloud-database',
            domain: 'data',
            detail:
              'Postgres copies of Unity Catalog tables, kept updated by a managed sync pipeline. The app reads them and should not write to them.',
          },
          {
            id: 'dev',
            label: 'Dev branch',
            sub: 'expires, scales to zero',
            col: 2,
            row: 2,
            icon: 'workflow',
            domain: 'orchestration',
            detail:
              'A copy-on-write child of production for development and tests. Set an expiration so it is billed only for the data you change on it.',
          },
          {
            id: 'delta',
            label: 'Delta tables',
            sub: 'Unity Catalog source',
            col: 3,
            row: 1,
            kind: 'store',
            icon: 'data-file',
            domain: 'governance',
            detail:
              'Curated lakehouse tables with a primary key. Triggered and Continuous syncs also need a change feed on them, either enabled or automatic.',
          },
          {
            id: 'history',
            label: 'Delta history tables',
            sub: 'lb_<table>_history',
            col: 3,
            row: 0,
            kind: 'store',
            icon: 'data-file',
            domain: 'governance',
            detail:
              'Unity Catalog managed Delta tables that record every insert, update, and delete from the app-owned tables. Public Preview.',
          },
        ],
        edges: [
          { from: 'users', to: 'app', label: 'HTTPS' },
          { from: 'app', to: 'apptbl', label: 'reads, writes' },
          { from: 'app', to: 'synced', label: 'reads' },
          { from: 'delta', to: 'synced', label: 'sync' },
          { from: 'apptbl', to: 'history', label: 'Change Data Feed' },
          { from: 'synced', to: 'dev', label: 'branch', dashed: true },
        ],
        legend: [
          { kind: 'dashed', label: 'Branching, not a data feed' },
          { kind: 'store', label: 'Data store' },
        ],
      },
    },
    {
      id: 'platform',
      heading: 'Projects, branches, and endpoints',
      prose:
        'The current Lakebase platform, once called Lakebase Autoscaling, organizes everything into projects. A project holds branches. Each branch has its own databases, roles, and compute endpoints. A new project starts with one branch named production and a database named databricks_postgres. Autoscaling and scale to zero are on for the production branch, with a 24-hour inactivity timeout. You connect to an endpoint with a standard Postgres client.',
      options: {
        caption: 'Which Lakebase to build on',
        rows: [
          {
            option: 'Lakebase (projects, branches, endpoints)',
            when: 'Every new app, and any existing app you are touching.',
            tradeoffs:
              'Autoscaling compute, scale to zero, branching, and instant restore. Bundles and the Postgres API use the postgres_* resources. Scale to zero adds a resume wait you must handle in code.',
          },
          {
            option: 'Lakebase Provisioned (instances)',
            when: 'Only existing instances. You cannot create new Provisioned databases after March 12, 2026.',
            tradeoffs:
              'Every instance was upgraded to the current platform by July 2026. The upgrade kept connection strings, API calls, bundle and Terraform configurations, and app environment variables. The Provisioned UI stayed available until September 1, 2026.',
          },
        ],
        recommendation:
          'Build on projects, branches, and endpoints. Leave an upgraded app on its old database_instance configuration until you next change its infrastructure, then move it to the postgres_* resources. Do not change an existing app resource key from database to postgres, because that creates a second role.',
      },
      links: [
        { label: 'Lakebase Postgres overview', url: 'https://docs.databricks.com/aws/en/oltp/projects/' },
        { label: 'Lakebase Provisioned', url: 'https://docs.databricks.com/aws/en/oltp/instances/' },
        { label: 'Branches', url: 'https://docs.databricks.com/aws/en/oltp/projects/branches' },
      ],
    },
    {
      id: 'app-resource',
      heading: 'The database resource and its Postgres role',
      prose:
        'Add the database in the app configuration under + Add resource > Database. Pick the project, branch, and database. The only permission today is Can connect and create. You need CAN MANAGE on the Lakebase project. The Databricks Apps guide covers resources and app.yaml in general, and this section covers what Lakebase adds.',
      points: [
        {
          strong: 'The role.',
          text: 'Databricks creates a Postgres role whose name is the service principal client ID, or reuses it if it exists. It grants CONNECT and CREATE on the database, so the app can create its own schemas and tables.',
        },
        {
          strong: 'Environment variables.',
          text: 'The first database resource sets PGHOST, PGPORT, PGDATABASE, PGUSER, PGSSLMODE, and PGAPPNAME. The default resource key is postgres. With more than one database, read each one with valueFrom and its resource key.',
        },
        {
          strong: 'The endpoint path is yours to supply.',
          text: 'The injected variables give a host and a user but not the projects/<project>/branches/<branch>/endpoints/<endpoint> path that token minting needs. Put that path in an app.yaml variable.',
        },
        {
          strong: 'Ownership outlives the app.',
          text: 'Tables the app creates are owned by its role and stay after a redeploy or stop. If you remove the resource, Databricks reassigns the objects to you and deletes the role when you have CAN MANAGE.',
        },
        {
          strong: 'Schema names.',
          text: 'In the template apps, Lakebase names the schema {app-name}_schema_{service-principal-id} with hyphens removed from the ID. In a registered Unity Catalog catalog the schema keeps the hyphens in the app name, so quote it with backticks.',
        },
      ],
      links: [
        {
          label: 'Add a Lakebase resource to an app',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase',
        },
        {
          label: 'Using Lakebase with Databricks Apps',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/databricks-apps',
        },
      ],
    },
    {
      id: 'connections',
      heading: 'OAuth tokens, refresh, and pooling',
      prose:
        'An OAuth role uses a Databricks identity and a short-lived token as the Postgres password. A password role uses an ordinary Postgres password. The choice also decides where pooling happens, because the built-in PgBouncer pooler supports only password roles.',
      options: {
        caption: 'How the app authenticates and pools',
        rows: [
          {
            option: 'OAuth role with an in-app pool',
            when: 'The default for a Databricks App. The app service principal already has an OAuth role.',
            tradeoffs:
              'No long-lived secret to store or rotate by hand. Your code must mint a token for each new connection, because tokens last one hour. Expiry is checked at login only, so open connections keep working. You size and manage the pool yourself.',
          },
          {
            option: 'Password role with PgBouncer',
            when: 'The client cannot refresh credentials every hour, or many short-lived connections (serverless functions, many app replicas) would exhaust server connections.',
            tradeoffs:
              'Passwords do not expire, and the pooler accepts up to 10,000 client connections in transaction mode. Password logins are disabled by default on new projects, you store and rotate the secret, and SQL-level PREPARE and session SET do not persist across transactions.',
          },
        ],
        recommendation:
          'Use OAuth with an in-app pool. Move to a password role and the -pooler hostname only when connection count is the problem. Either way, add retries, because connections idle for 24 hours close and connections older than 3 days may close.',
      },
      diagram: {
        type: 'flow',
        title: 'Token minted for each new pooled connection',
        description:
          'The app asks its connection pool for a connection. When the pool opens a new connection, it calls the Databricks SDK to mint an OAuth token for the endpoint, then connects to the Lakebase endpoint using the token as the Postgres password. The Postgres role matches the app identity.',
        nodes: [
          {
            id: 'code',
            label: 'App request',
            sub: 'handler code',
            col: 0,
            row: 0,
            kind: 'surface',
            icon: 'gear-lava',
            domain: 'apps',
            detail: 'A request handler borrows a connection from the pool, runs a query, and returns it.',
          },
          {
            id: 'pool',
            label: 'Connection pool',
            sub: 'psycopg_pool',
            col: 1,
            row: 0,
            kind: 'highlight',
            icon: 'network',
            domain: 'apps',
            detail:
              'Holds open connections between min_size and max_size and checks them on checkout, so a connection that died during suspension is replaced.',
          },
          {
            id: 'token',
            label: 'Mint OAuth token',
            sub: 'SDK, one hour',
            col: 1,
            row: 1,
            icon: 'id-provider',
            domain: 'governance',
            detail:
              'generate_database_credential returns a token for the endpoint, valid for one hour. The pool calls it each time it opens a connection.',
          },
          {
            id: 'endpoint',
            label: 'Lakebase endpoint',
            sub: 'host, SSL required',
            col: 2,
            row: 0,
            kind: 'store',
            icon: 'cloud-database',
            domain: 'data',
            detail:
              'Accepts the token as the password at login. Token expiry is enforced only then, and SSL is required.',
          },
          {
            id: 'role',
            label: 'Postgres role',
            sub: 'service principal ID',
            col: 3,
            row: 0,
            icon: 'database',
            domain: 'data',
            detail:
              'The role Databricks created when you added the resource. It owns the app tables and holds CONNECT and CREATE on the database.',
          },
        ],
        edges: [
          { from: 'code', to: 'pool', label: 'borrow' },
          { from: 'pool', to: 'token', label: 'new connection', dashed: true },
          { from: 'pool', to: 'endpoint', label: 'token as password' },
          { from: 'endpoint', to: 'role', label: 'login as' },
        ],
      },
      examples: [
        {
          label: 'psycopg pool that mints a token per connection',
          language: 'python',
          code: `import os
import time

import psycopg
from databricks.sdk import WorkspaceClient
from psycopg import OperationalError
from psycopg_pool import ConnectionPool

w = WorkspaceClient()  # inside a Databricks App this uses the app identity
ENDPOINT = os.environ['LAKEBASE_ENDPOINT']  # projects/<project>/branches/<branch>/endpoints/<endpoint>


class TokenConnection(psycopg.Connection):
    @classmethod
    def connect(cls, conninfo='', **kwargs):
        # A new token for every new physical connection.
        kwargs['password'] = w.postgres.generate_database_credential(endpoint=ENDPOINT).token
        return super().connect(conninfo, **kwargs)


pool = ConnectionPool(
    conninfo=(
        f"dbname={os.environ['PGDATABASE']} user={os.environ['PGUSER']} "
        f"host={os.environ['PGHOST']} port={os.environ['PGPORT']} "
        f"sslmode={os.environ['PGSSLMODE']}"
    ),
    connection_class=TokenConnection,
    min_size=1,
    max_size=10,
    max_lifetime=1800,  # recycle connections well inside the 3-day limit
    check=ConnectionPool.check_connection,  # replace connections that died while idle or suspended
    open=True,
)


def read_rows(sql, params=None, attempts=4):
    for attempt in range(attempts):
        try:
            with pool.connection(timeout=10) as conn:
                return conn.execute(sql, params).fetchall()
        except OperationalError:
            if attempt == attempts - 1:
                raise
            time.sleep(0.5 * 2**attempt)  # waits out a compute that is resuming`,
          notes: [
            'The connection parameters, the pool sizes, and the SQLAlchemy variant that refreshes a token within 2 minutes of expiry follow the Lakebase authentication page. The check, max_lifetime, timeout, and retry loop are additions for suspension and idle closes.',
            'Retry only reads, or writes that are safe to repeat. A retried INSERT without a key can duplicate a row.',
            'Outside Databricks, create the WorkspaceClient with service principal credentials. The token endpoint is workspace-scoped, so the project and the token must belong to the same workspace.',
          ],
        },
        {
          label: 'Password role with the pooler hostname',
          language: 'text',
          code: `# Create a native Postgres password role first (password logins are off by default on new projects).
# Copy the pooled string from Connect, with a password role selected.
host=<endpoint-id>-pooler.<region>.<cloud>.databricks.com  port=5432  sslmode=require`,
          notes: [
            'Read-write compute uses -pooler. Read-only compute uses -ro-pooler and needs a high availability endpoint with read access enabled.',
            'The pooler runs in transaction mode with fixed settings. Driver-level prepared statements work, but PREPARE statements and session SET commands do not carry across transactions. With JDBC, set prepareThreshold=0 if prepared statements fail.',
            'A request that waits 2 minutes for a free server connection times out.',
          ],
        },
      ],
      links: [
        {
          label: 'Authenticate to Lakebase Postgres',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/authentication',
        },
        { label: 'Use connection pooling', url: 'https://docs.databricks.com/aws/en/oltp/projects/connection-pooling' },
        { label: 'Manage Postgres roles', url: 'https://docs.databricks.com/aws/en/oltp/projects/manage-roles' },
      ],
    },
    {
      id: 'identity',
      heading: 'App identity or user identity',
      prose:
        'By default the app connects as its own service principal. Databricks Apps can also pass a signed-in user token to the app, in the x-forwarded-access-token header, when you configure user authorization with scopes.',
      options: {
        caption: 'Whose permissions the database sees',
        rows: [
          {
            option: 'App identity (service principal)',
            when: 'Users share the same data, or the app decides who sees which rows.',
            tradeoffs:
              'One Postgres role, one pool, and Databricks creates the role for you. Postgres sees every request as the app, so per-user rules live in your code and audit logs show the service principal.',
          },
          {
            option: 'User identity (forwarded token)',
            when: 'Database permissions must follow the person, such as separate grants per user.',
            tradeoffs:
              'Postgres sees the real user. Every user needs a Postgres role, which you create with the databricks_auth extension, and the app must request the postgres scope. A pooled connection belongs to one user, so you cannot share a pool across users. The docs show no worked Lakebase example.',
          },
        ],
        recommendation:
          'Use the app identity and enforce per-user rules in application code. Choose user identity only when audit or grants must be per person, and test the full path, including role creation and the scope, before you build on it.',
      },
      points: [
        {
          strong: 'Scope status.',
          text: 'The Databricks Apps authorization page (updated October 9, 2026) lists postgres among the supported API scopes.',
        },
        {
          strong: 'Role per identity.',
          text: 'Whichever identity connects, it needs a matching Postgres role. The project owner gets one automatically, and the app service principal gets one from the resource. Create roles for other users with the databricks_auth extension.',
        },
      ],
      links: [
        {
          label: 'Databricks Apps authorization',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth',
        },
        {
          label: 'Authenticate to Lakebase Postgres',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/authentication',
        },
      ],
    },
    {
      id: 'scale',
      heading: 'Scale to zero, autoscaling, and cold starts',
      prose:
        'Autoscaling moves a running compute between a minimum and a maximum size, based on CPU load, memory use, and working set size. One compute unit (CU) is 2 GB of RAM, autoscaling goes up to 64 CU (128 GB), and the maximum minus the minimum cannot exceed 16 CU. Scaling inside the range needs no restart. Scale to zero is separate. It suspends the whole compute after inactivity, and the compute resumes at its minimum size on the next query.',
      options: {
        caption: 'Whether the compute may suspend',
        rows: [
          {
            option: 'Scale to zero on, default 24-hour timeout',
            when: 'Production apps with predictable idle stretches, such as nights and weekends.',
            tradeoffs:
              'No compute charge while suspended. The first query after a suspension waits for the compute to resume, which the docs put at a few hundred milliseconds, and the Apps tutorial notes can take a few seconds after a long pause. Session state is lost.',
          },
          {
            option: 'Scale to zero on, short timeout',
            when: 'Dev, test, and preview branches. The docs suggest 30 minutes for development branches.',
            tradeoffs: 'Lowest cost for intermittent use, and the most resumes. Allowed range is 60 seconds to 7 days.',
          },
          {
            option: 'Scale to zero off',
            when: 'Latency-sensitive production apps, a maximum above 32 CU, or a high availability endpoint.',
            tradeoffs:
              'No resume wait and session state persists. Compute bills at least the minimum size all the time. Scale to zero is not available above 32 CU maximum or on high availability endpoints.',
          },
        ],
        recommendation:
          'Leave scale to zero on for dev and test branches with a short timeout. For production, keep the 24-hour default if the app tolerates one slow first request. Otherwise turn it off and set a minimum size you can afford.',
      },
      points: [
        {
          strong: 'What suspension clears.',
          text: 'Cache contents and in-memory statistics, temporary tables, prepared statements, session settings, connection pools, and open transactions. Data, connection strings, and credentials stay.',
        },
        {
          strong: 'Retries.',
          text: 'Open connections do not survive a suspension, so the next use of a pooled connection fails. Check connections on checkout, retry with a short backoff, and repeat only idempotent work.',
        },
        {
          strong: 'Warm-up.',
          text: 'The docs list application-level connection warming, a longer timeout, or no scale to zero as ways to avoid a slow first request.',
        },
        {
          strong: 'Other limits.',
          text: 'Changing the minimum or maximum CU can briefly interrupt active connections. Connections idle for 24 hours close, and connections older than 3 days may close.',
        },
      ],
      links: [
        { label: 'Scale to zero', url: 'https://docs.databricks.com/aws/en/oltp/projects/scale-to-zero' },
        { label: 'Autoscaling', url: 'https://docs.databricks.com/aws/en/oltp/projects/autoscaling' },
      ],
    },
    {
      id: 'synced-tables',
      heading: 'Synced tables and their modes',
      prose:
        'A synced table copies a Unity Catalog table into Lakebase and keeps it updated with a managed Lakeflow pipeline. This is reverse ETL. Sources are managed or external Delta or Iceberg tables, views, and materialized views. You get a synced table in Unity Catalog and a read-only Postgres table. The Unity Catalog schema name becomes the Postgres schema name, so analytics.gold.user_profiles_synced is gold.user_profiles_synced in Postgres. Synced tables are generally available.',
      diagram: {
        type: 'matrix',
        title: 'Synced table modes at a glance',
        description:
          'A comparison of Snapshot, Triggered, and Continuous sync modes by freshness, cost, source requirement, initial load, and best fit.',
        corner: 'What matters',
        columns: ['Snapshot', 'Triggered', 'Continuous'],
        rows: [
          {
            label: 'Freshness',
            cells: [
              { state: 'none', text: 'Full copy per run' },
              { state: 'optional', text: 'Per scheduled run' },
              { state: 'own', text: 'Seconds of lag' },
            ],
          },
          {
            label: 'Cost',
            cells: [
              {
                state: 'own',
                text: 'Efficient with high churn',
                detail:
                  'About 10x more efficient than incremental modes when more than 10% of source rows change per cycle.',
              },
              {
                state: 'optional',
                text: 'Costly under 5 minutes',
                detail: 'Good balance of cost and lag, but expensive when run at intervals shorter than 5 minutes.',
              },
              {
                state: 'none',
                text: 'Highest',
                detail: 'Lowest lag and highest cost, with a minimum interval of 15 seconds.',
              },
            ],
          },
          {
            label: 'Source requirement',
            cells: [
              { state: 'own', text: 'SELECT only' },
              { state: 'optional', text: 'Change feed needed' },
              { state: 'optional', text: 'Change feed needed' },
            ],
          },
          {
            label: 'Initial load (LTAP Direct Writes, Beta)',
            cells: [
              { state: 'own', text: 'Every sync' },
              { state: 'optional', text: 'First load only' },
              { state: 'optional', text: 'First load only' },
            ],
          },
          {
            label: 'Best for',
            cells: [
              { state: 'own', text: 'Nightly bulk refresh' },
              { state: 'own', text: 'Known cadence' },
              { state: 'own', text: 'Near-real-time reads' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Strength' },
          { state: 'optional', label: 'Trade-off' },
          { state: 'none', label: 'Weak point' },
        ],
      },
      options: {
        caption: 'Which sync mode',
        rows: [
          {
            option: 'Snapshot',
            when: 'More than 10% of rows change per cycle, or the source changes rarely and a nightly or weekly refresh is enough.',
            tradeoffs:
              'Copies everything each run, so the source needs only SELECT. Data is as old as the last run, and you must trigger every run after the first.',
          },
          {
            option: 'Triggered',
            when: 'The source changes on a known cadence and the app tolerates minutes of lag.',
            tradeoffs:
              'Applies inserts, updates, and deletes incrementally. A table update trigger on the source in Lakeflow Jobs gives near-real-time freshness without the always-on cost. Needs a change feed on the source. Expensive below 5-minute intervals.',
          },
          {
            option: 'Continuous',
            when: 'Changes must reach the app within seconds.',
            tradeoffs:
              'Streams with seconds of lag, minimum 15-second intervals, and the highest cost because the pipeline runs all the time. Needs a change feed on the source.',
          },
        ],
        recommendation:
          'Default to Triggered with a table update trigger. Use Snapshot for large, slowly changing tables, and Continuous only when a user-facing screen needs seconds-old data and the extra cost is justified.',
      },
      points: [
        {
          strong: 'Change feed on the source.',
          text: 'Triggered and Continuous need row-level changes. Enable write-time change data feed on a Delta source, or use Automatic change data feed, which became generally available on September 1, 2026 and lets sources such as Iceberg tables sync in these modes.',
        },
        {
          strong: 'Keys.',
          text: 'The source needs a primary key. Primary key columns cannot be null in the synced table, and rows with a null key are left out. If key values repeat, set a timeseries key so the table keeps the latest row per key.',
        },
        {
          strong: 'Permissions and writes.',
          text: 'You need USE_SCHEMA and CREATE_TABLE on the target schema. Synced tables are read-only in practice. Databricks advises running only reads, and only CREATE, ALTER, and DROP INDEX and DROP TABLE are allowed as DDL.',
        },
        {
          strong: 'Limits to plan for.',
          text: 'Each sync can use up to 16 database connections. Throughput is about 150 rows per second per CU for Triggered and Continuous, and up to 2,000 for Snapshot. ARRAY, MAP, and STRUCT become JSONB. GEOGRAPHY, GEOMETRY, VARIANT, and OBJECT are not supported.',
        },
        {
          strong: 'Vectors.',
          text: 'A type override can store an ARRAY<FLOAT> column as vector(n). Install the extension before you create the synced table, because the sync does not install it.',
        },
      ],
      examples: [
        {
          label: 'Enable change data feed, then create a Triggered synced table',
          language: 'python',
          code: `# In SQL, on the source:
#   ALTER TABLE main.sales.orders SET TBLPROPERTIES (delta.enableChangeDataFeed = true)
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.postgres import (
    SyncedTable,
    SyncedTableSyncedTableSpec,
    SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy as Policy,
)

w = WorkspaceClient()
synced = w.postgres.create_synced_table(
    synced_table=SyncedTable(
        spec=SyncedTableSyncedTableSpec(
            source_table_full_name='main.sales.orders',
            branch='projects/my-project/branches/production',
            primary_key_columns=['order_id'],
            scheduling_policy=Policy.TRIGGERED,
            postgres_database='mydb',
            create_database_objects_if_missing=True,
        )
    ),
    synced_table_id='my-catalog.sales.orders',  # catalog.schema.table of the synced table
).wait()`,
          notes: [
            'The docs example uses SNAPSHOT. Policy values are CONTINUOUS, TRIGGERED, and SNAPSHOT.',
            'The first sync runs on creation. For Snapshot and Triggered, add a Database Table Sync pipeline task to a Lakeflow Job with a schedule or a table update trigger. Continuous runs itself.',
            'LTAP Direct Writes (Beta) is a per-table opt-in at creation that speeds the initial load. You cannot add it later, so recreate the table to change it.',
          ],
        },
      ],
      links: [
        { label: 'Synced tables', url: 'https://docs.databricks.com/aws/en/oltp/projects/sync-tables' },
        {
          label: 'Quickstart: serve lakehouse data',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/quickstart-synced-tables',
        },
      ],
    },
    {
      id: 'write-back',
      heading: 'Getting app writes back to Delta',
      prose:
        'Analysts cannot query rows that live only in Postgres from a warehouse unless you bring them over. Lakebase Change Data Feed (Public Preview) records each insert, update, and delete from the write-ahead log as a row in a Unity Catalog managed Delta table. Changes are batched and flushed about every 15 seconds. The feed is set up per schema, so every current and future table in the source schema is included.',
      options: {
        caption: 'How analytics sees app data',
        rows: [
          {
            option: 'Change Data Feed to Delta',
            when: 'You need history, an audit trail, or incremental pipelines on app data.',
            tradeoffs:
              'Immutable change history in an open format, with no external CDC tool. It is a Public Preview that a workspace admin must enable, needs Postgres 16, 17, or 18, REPLICA IDENTITY FULL on each table, and does not support destination catalogs with default storage.',
          },
          {
            option: 'Registered Unity Catalog catalog',
            when: 'You want to join live Lakebase rows with Delta tables in a query, with no copy.',
            tradeoffs:
              'Always current and governed, but read-only, serverless compute only, and every query reads Postgres. It gives no history and puts analytical load on the app database.',
          },
          {
            option: 'App writes to Delta itself',
            when: 'Rarely. Only for a very small, low-volume event that has no Postgres copy.',
            tradeoffs:
              'Two writes that can disagree, and the app depends on a warehouse again. You own consistency and retries.',
          },
        ],
        recommendation:
          'Use Change Data Feed for anything analytics needs from app tables, and a registered catalog for ad hoc joins. Treat the Public Preview status as a planning risk and keep the feed configuration in code.',
      },
      examples: [
        {
          label: 'Set up the feed, then read current state',
          language: 'sql',
          code: `-- Postgres: run once per table (or loop over the schema, or add an event trigger for new tables).
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Start the feed from the Lakebase CDF tab on the branch (or the API), choosing a source
-- schema and a destination catalog and schema. History lands in lb_orders_history.

-- Databricks SQL: latest version of each order that is not deleted.
SELECT * EXCEPT (rn, _pg_change_type, _timestamp, _pg_lsn, _pg_xid)
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY _pg_lsn DESC) AS rn
  FROM main.app_history.lb_orders_history
  WHERE _pg_change_type <> 'update_preimage'
)
WHERE rn = 1 AND _pg_change_type <> 'delete';`,
          notes: [
            'The history table carries _pg_change_type, _timestamp, _pg_lsn, and _pg_xid. The initial snapshot arrives as insert events.',
            'The docs state the shape matches Delta Change Data Feed, so update_preimage rows hold old values and the query above drops them. Confirm the change type values in your own table before you rely on them.',
            'Check feed state from Postgres with SELECT * FROM wal2delta.tables.',
          ],
        },
      ],
      links: [
        {
          label: 'Lakebase Change Data Feed',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/lakebase-cdf',
        },
        {
          label: 'Quickstart: Lakebase Change Data Feed',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/quickstart-lakebase-cdf',
        },
      ],
    },
    {
      id: 'register-uc',
      heading: 'Registering the database in Unity Catalog',
      prose:
        'Registration creates a read-only catalog that mirrors a Lakebase database, so permissions, lineage, and audit logs apply and analysts can join it with lakehouse tables. Start from Catalog Explorer, choose Lakebase Postgres as the catalog type with the Autoscaling option, and pick the project, branch, and database. You need CREATE CATALOG on the metastore.',
      points: [
        {
          strong: 'Serverless only.',
          text: 'Query and browse the catalog with a serverless SQL warehouse or serverless notebooks and jobs. A pro or classic warehouse returns PERMISSION_DENIED (UC_LAKEBASE_CATALOG_ACCESS_DENIED).',
        },
        {
          strong: 'One database per catalog.',
          text: 'Register each database separately. You cannot register a branched database as its own catalog, and a branch of a registered database inherits the registration metadata, which makes a new registration fail.',
        },
        {
          strong: 'Late metadata.',
          text: 'Unity Catalog caches metadata, so new tables may not appear at once. Refresh the catalog to force it.',
        },
        {
          strong: 'Duplicate paths.',
          text: 'A synced table in a standard catalog that targets a database also registered as a catalog appears under both catalogs.',
        },
      ],
      links: [
        {
          label: 'Register a Lakebase database in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/oltp/projects/register-uc',
        },
      ],
    },
    {
      id: 'branches',
      heading: 'Branches for dev and test, and what they cost',
      prose:
        'A branch is a copy-on-write child of its parent. Creating one is instant at any database size, because it shares the parent storage and writes new data only when something changes. Changes in a child never reach the parent, including roles, databases, grants, and revokes. You move schema changes with your migration tool, and you can reset a child from its parent to refresh it. You can also branch from a point in time inside the restore window to recover or audit data.',
      options: {
        caption: 'Branch types for an app team',
        rows: [
          {
            option: 'Expiring branch (dev, test, per-developer)',
            when: 'Short-lived work such as feature development, schema tests, and pull-request previews.',
            tradeoffs:
              'Billed for storage only on the data that changes. Modifying 1 GB on a 100 GB database costs about 1 GB. Compute bills only while active and suspends when idle. The branch is deleted when it expires.',
          },
          {
            option: 'Permanent branch (staging)',
            when: 'A long-lived pre-production copy that holds integration or load tests.',
            tradeoffs:
              'Billed for its full data size like an independent database, even if it differs little from the parent. Reset it from production on a schedule to refresh test data.',
          },
          {
            option: 'Protected branch (production)',
            when: 'The branch whose loss would hurt. One per project.',
            tradeoffs:
              'Cannot be deleted or reset, is exempt from archival for inactivity, and gets storage-cache priority. It also blocks deletion of the project.',
          },
        ],
        recommendation:
          'Give every dev and test branch an expiration, and make a branch permanent only on purpose. Protect production, keep one permanent staging branch if you need it, and reset it from production on a schedule.',
      },
      points: [
        {
          strong: 'The default branch.',
          text: 'The default branch, production at first, does not count toward the limit on concurrently active computes.',
        },
        {
          strong: 'Dev compute.',
          text: 'Each branch has its own compute with its own size and scale to zero timeout, so a dev branch used a few hours a day costs far less than an always-on server.',
        },
        {
          strong: 'Registration and branches.',
          text: 'Do not branch from a database that is registered in Unity Catalog if you plan to register the branch. See the registration section.',
        },
      ],
      links: [
        { label: 'Branches', url: 'https://docs.databricks.com/aws/en/oltp/projects/branches' },
        { label: 'Manage branches', url: 'https://docs.databricks.com/aws/en/oltp/projects/manage-branches' },
      ],
    },
    {
      id: 'bundles',
      heading: 'Defining it in a bundle',
      prose:
        'Declarative Automation Bundles can define the project, branches, and compute endpoints (Beta), added with Databricks CLI 0.287.0 on February 5, 2026. Creating a project or a branch also creates its read-write endpoint, named primary, with the default endpoint settings of the project, so set size and scale to zero once on the project and declare a postgres_endpoint only for an extra endpoint. Declaring primary again fails with read_write endpoint already exists. Newer resources cover roles, databases, catalogs, synced tables, and snapshot schedules, also in Beta. The older database_instance resource now creates Lakebase projects, and Databricks recommends postgres_projects for new work.',
      examples: [
        {
          label: 'Project, production and dev branches, and an app resource',
          language: 'yaml',
          code: `resources:
  postgres_projects:
    orders_db:
      project_id: orders-app
      display_name: Orders app database
      pg_version: 17
      history_retention_duration: 604800s
      # Applies to the primary endpoint each branch gets when it is created.
      default_endpoint_settings:
        autoscaling_limit_min_cu: 0.5
        autoscaling_limit_max_cu: 4
        suspend_timeout_duration: 1800s

  postgres_branches:
    main:
      parent: \${resources.postgres_projects.orders_db.id}
      branch_id: main
      no_expiry: true
    dev:
      parent: \${resources.postgres_projects.orders_db.id}
      branch_id: dev
      ttl: 604800s  # expires after 7 days, billed only for changed data

  apps:
    orders_app:
      name: orders-app
      source_code_path: .
      resources:
        - name: lakebase-db
          postgres:
            branch: \${resources.postgres_branches.main.id}
            database: projects/orders-app/branches/main/databases/<database-id>
            permission: CAN_CONNECT_AND_CREATE`,
          notes: [
            'The project, branch, and endpoint structure follows the bundle reference example. The ttl field is documented as a relative time-to-live, and branch fields accept expire_time, no_expiry, or ttl.',
            'The database ID comes from the databases page of the branch. A postgres_databases resource also exists (Beta, CLI 1.4.0) if you want the bundle to create it.',
            'Dev and test bundle targets can deploy the same project with a short ttl and a short suspend timeout, and production can set is_protected on its branch.',
          ],
        },
      ],
      links: [{ label: 'Bundle resources', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources' }],
    },
    {
      id: 'pgvector',
      heading: 'pgvector and vector search',
      prose:
        'Postgres extensions install with CREATE EXTENSION. The vector extension (pgvector) is available on Postgres 16, 17, and 18, at version 0.8.0 on 16 and 17 and 0.8.6 on 18, with ivfflat and hnsw indexes. Lakebase Search adds lakebase_vector, an approximate nearest-neighbor index (lakebase_ann) that works with the same vector types, operators, and queries.',
      options: {
        caption: 'Which vector index',
        rows: [
          {
            option: 'pgvector (ivfflat or hnsw)',
            when: 'A small or medium embedding set, or a team that already knows pgvector.',
            tradeoffs:
              'Nothing to enable. You tune index parameters and rebuild as data grows. A new extension version needs a compute restart before you can install it, and a compute with scale to zero off does not restart on its own.',
          },
          {
            option: 'lakebase_vector (Lakebase Search)',
            when: 'Large embedding sets, fast index builds, or hybrid vector and keyword search.',
            tradeoffs:
              'Enable Lakebase Search in the project settings first. The docs describe IVF partitioning with RaBitQ quantization, indexes beyond 1 billion vectors, and storage-backed indexes that survive scale to zero without warmup. Index storage formats upgrade separately from the extension.',
          },
        ],
        recommendation:
          'Start with pgvector for a prototype. Move to lakebase_vector when the table grows or when you need hybrid search with lakebase_text. The two share types and operators, so the change is an index swap.',
      },
      examples: [
        {
          label: 'Install and query',
          language: 'sql',
          code: `-- Use IF NOT EXISTS so a rerun does not fail.
CREATE EXTENSION IF NOT EXISTS vector;
-- Or, with Lakebase Search enabled: this installs pgvector as a dependency.
-- CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE;

CREATE TABLE docs (
  id BIGSERIAL PRIMARY KEY,
  body TEXT,
  embedding VECTOR(1024)
);

CREATE INDEX docs_embedding_idx ON docs USING hnsw (embedding vector_cosine_ops);

SELECT id, body
FROM docs
ORDER BY embedding <=> $1
LIMIT 5;`,
          notes: [
            'The embedding size must match your model. In a synced-table type override, vector(n) takes 1 to 16,000 dimensions.',
            'Release stage. The ai_search function can search Lakebase synced tables that have Lakebase Search enabled, a Beta feature announced on September 24, 2026. The Lakebase Search page does not state its own stage in the text reviewed.',
          ],
        },
      ],
      links: [
        { label: 'Postgres extensions', url: 'https://docs.databricks.com/aws/en/oltp/projects/extensions' },
        { label: 'Lakebase Search', url: 'https://docs.databricks.com/aws/en/oltp/projects/lakebase-search' },
        { label: 'lakebase_vector', url: 'https://docs.databricks.com/aws/en/oltp/projects/lakebase-vector' },
      ],
    },
  ],
  related: [
    { slug: 'databricks-apps', title: 'Databricks Apps, App Spaces and Serverless Micro Apps' },
    { slug: 'external-integrations', title: 'Partner tool integrations' },
    { slug: 'agent-build-deployment', title: 'Building and shipping agents' },
  ],
};
