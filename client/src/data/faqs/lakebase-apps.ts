import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'What is Lakebase, and is it generally available?',
    answer:
      'Lakebase is a fully managed Postgres database inside the Databricks platform, built for low-latency transactional apps that sit next to lakehouse data. The docs overview describes it as generally available, with one exception. Storing Postgres changes in the lakehouse (Change Data Feed) is in Public Preview. The overview lists these uses: transactional app backends, synced Unity Catalog tables, change capture into Delta, online feature serving and agent state.',
    links: [
      { label: 'Lakebase Postgres overview', url: 'https://docs.databricks.com/aws/en/oltp/projects/' },
      { label: 'Lakebase use cases', url: 'https://docs.databricks.com/aws/en/oltp/projects/use-cases' },
    ],
  },
  {
    kind: 'decision',
    question: 'Should my app use Lakebase or read Delta tables through a SQL warehouse?',
    answer:
      'Use Lakebase when the app does transactional work, meaning low-latency reads and writes of individual rows. Use a SQL warehouse when the app runs analytical queries over lakehouse tables. The docs position Lakebase as an operational (OLTP) database and SQL warehouses as optimized for batch analytics (OLAP). Many apps need both, so a common split keeps app state in Lakebase and syncs curated lakehouse data into it for fast lookups.',
    links: [
      { label: 'Lakebase use cases', url: 'https://docs.databricks.com/aws/en/oltp/projects/use-cases' },
      {
        label: 'Build applications on Lakebase',
        url: 'https://docs.databricks.com/aws/en/oltp/projects/build-applications',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'For a new app, should I choose Lakebase Autoscaling or Lakebase Provisioned?',
    answer:
      'Choose the current Lakebase platform, which was previously called Lakebase Autoscaling. Provisioned was the original version, with fixed-size compute that you scaled by hand. The Provisioned page says you cannot create new Provisioned databases after March 12, 2026, that all existing instances were upgraded to the new platform by July 2026, and that the old Provisioned UI was available until September 1, 2026. The upgrade kept connection strings, API calls and app environment variables, so existing apps keep working.',
    links: [
      { label: 'Lakebase Provisioned', url: 'https://docs.databricks.com/aws/en/oltp/instances/' },
      {
        label: 'Add a Lakebase resource to an app',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase',
      },
    ],
  },
  {
    question: 'What are projects, branches and endpoints, and what do I get by default?',
    answer:
      'A project holds branches, and each branch has its own databases and compute. A new project starts with one branch named production and a database named databricks_postgres. Autoscaling and scale to zero are on by default for the production branch, with a 24-hour inactivity timeout. The project region is set to your workspace region. You connect to a compute endpoint with a standard Postgres client.',
    links: [
      { label: 'Get started with Lakebase', url: 'https://docs.databricks.com/aws/en/oltp/projects/get-started' },
      { label: 'Branches', url: 'https://docs.databricks.com/aws/en/oltp/projects/branches' },
    ],
  },
  {
    question: 'How do I give a Databricks App access to a Lakebase database?',
    answer:
      'Add the database as an app resource under + Add resource > Database. Pick the project, branch and database, and set the permission to Can connect and create, which is the only option today. You need CAN MANAGE on the Lakebase project. Databricks then creates a Postgres role named after the app service principal client ID, or reuses it, and grants it CONNECT and CREATE on the database. The default resource key is postgres. The app gets PGHOST, PGPORT, PGDATABASE, PGUSER, PGSSLMODE and PGAPPNAME for the first database resource. For more than one database, use valueFrom with the resource key. Do not switch an existing database resource to postgres, because that creates a separate role and breaks access to existing data.',
    links: [
      {
        label: 'Add a Lakebase resource to an app',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase',
      },
      {
        label: 'Add resources to a Databricks app',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does OAuth token authentication cost me in code compared with a stored password?',
    answer:
      'OAuth means no long-lived secret to store, but your code must refresh credentials. Lakebase OAuth tokens expire after one hour. Expiry is checked only at login, so open connections keep working after the token expires. Any app that opens new connections over time needs rotation logic. The docs show a psycopg3 pool that mints a fresh token for every new connection and a SQLAlchemy listener that refreshes the token when it is within 2 minutes of expiry. Native Postgres passwords never expire on their own, but they are disabled by default on new projects and you must store them securely.',
    links: [
      {
        label: 'Authenticate to Lakebase Postgres',
        url: 'https://docs.databricks.com/aws/en/oltp/projects/authentication',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Should my app connect with an OAuth role or a native Postgres password role?',
    answer:
      'Default to OAuth, and use a password role when you need the built-in connection pooler or when the client cannot refresh credentials every hour. The authentication page says the built-in PgBouncer pooler does not support OAuth and that pooled connections need native password roles. Passwords do not expire hourly, but password connections are disabled by default on new projects and you must enable them. A Databricks App using the app service principal gets its role created for it, so OAuth is the lowest-effort path there.',
    links: [
      {
        label: 'Authenticate to Lakebase Postgres',
        url: 'https://docs.databricks.com/aws/en/oltp/projects/authentication',
      },
      { label: 'Connect to Lakebase', url: 'https://docs.databricks.com/aws/en/oltp/projects/connect' },
    ],
  },
  {
    kind: 'decision',
    question: 'Should the app query Lakebase as itself or on behalf of each user?',
    answer:
      'Use the app identity unless users need different data access, and enforce per-user rules in your app code. The app identity is the service principal, whose Postgres role Databricks creates when you add the resource. Databricks Apps also supports user authorization, which forwards the user token in the x-forwarded-access-token header, with scopes you choose. The Apps authorization docs (updated October 9, 2026) list postgres among the supported scopes, and every identity that connects to Lakebase needs its own Postgres role. The docs show no worked per-user Lakebase example, so test the full path before you build on it.',
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
    kind: 'tradeoff',
    question: 'How should I pool connections, given the OAuth and PgBouncer limits?',
    answer:
      'An in-app pool with token refresh works with OAuth, while the built-in PgBouncer pooler needs a native password role. You trade rotation code for a server-side pooler. The docs show a psycopg3 pool (min_size 1, max_size 10 in the example) that fetches a fresh token whenever it opens a connection. Connections idle for 24 hours are closed, and connections older than 3 days may be closed. Add retry logic either way. The synced tables page also states that Lakebase supports up to 1,000 concurrent connections, and each synced table can use up to 16 of them.',
    links: [
      {
        label: 'Authenticate to Lakebase Postgres',
        url: 'https://docs.databricks.com/aws/en/oltp/projects/authentication',
      },
      { label: 'Synced tables', url: 'https://docs.databricks.com/aws/en/oltp/projects/sync-tables' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Does scale to zero save money, and what does it do to my app on the first request?',
    answer:
      'It saves compute while the database is idle, and the price is a short wake-up on the first query and a loss of session state. The default inactivity timeout is 24 hours, and you can set it from 60 seconds to 7 days. The docs say compute reactivates within a few hundred milliseconds of a new query, with the same connection string and credentials. Suspension clears caches, temporary tables, prepared statements, session settings, connection pools and open transactions, so the app needs retry logic. Scale to zero requires a maximum size of 32 CU or less. Turn it off for latency-sensitive production apps that need immediate responses.',
    links: [
      { label: 'Scale to zero', url: 'https://docs.databricks.com/aws/en/oltp/projects/scale-to-zero' },
      { label: 'Autoscaling', url: 'https://docs.databricks.com/aws/en/oltp/projects/autoscaling' },
    ],
  },
  {
    question: 'How does autoscaling size the compute?',
    answer:
      'Lakebase scales compute between a minimum and maximum you set, based on CPU load, memory use and working set size. Each compute unit (CU) gives 2 GB of RAM, and autoscaling goes up to 64 CU (128 GB). The gap between maximum and minimum cannot exceed 16 CU. Scaling inside your range happens without a restart or dropped connections. Larger computes are available at a fixed size.',
    links: [{ label: 'Autoscaling', url: 'https://docs.databricks.com/aws/en/oltp/projects/autoscaling' }],
  },
  {
    kind: 'decision',
    question: 'Should the app read synced tables or should I copy lakehouse data into Postgres myself?',
    answer:
      'Use a synced table for lakehouse data the app only reads, and keep app-owned data in ordinary Postgres tables. A synced table copies a Unity Catalog table into Lakebase and keeps it updated. Sources can be managed or external Delta or Iceberg tables, views and materialized views. Synced tables are read-only in Postgres, and the docs advise against direct writes because they interfere with the sync pipeline. The source needs a primary key, and the target schema needs USE_SCHEMA and CREATE_TABLE.',
    links: [
      { label: 'Synced tables', url: 'https://docs.databricks.com/aws/en/oltp/projects/sync-tables' },
      {
        label: 'Quickstart: serve lakehouse data',
        url: 'https://docs.databricks.com/aws/en/oltp/projects/quickstart-synced-tables',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Which synced table mode should I pick, and what does freshness cost?',
    answer:
      'Pick Triggered for a known refresh schedule, Continuous only when the app needs seconds-old data, and Snapshot for infrequent bulk loads. Continuous streams with seconds of latency, costs the most and has a 15-second minimum interval. Triggered balances cost and latency, but the docs call it expensive when triggered more often than every 5 minutes. Snapshot is a full copy and the docs call it about 10x more efficient when more than 10% of rows change per cycle. Triggered and Continuous need a change feed on the source, either Delta Change Data Feed or Automatic change data feed (generally available September 1, 2026). The docs give about 150 rows per second per capacity unit for those modes and up to 2,000 for Snapshot.',
    links: [{ label: 'Synced tables', url: 'https://docs.databricks.com/aws/en/oltp/projects/sync-tables' }],
  },
  {
    question: 'How do I get data my app wrote to Lakebase back into Delta?',
    answer:
      'Use Lakebase Change Data Feed, which records row-level changes from Postgres tables as Unity Catalog managed Delta tables. It is in Public Preview. You configure it per schema, so current and future tables in that schema are included. The quickstart requires Postgres replica identity set to FULL to capture old and new row values. The history tables carry _pg_change_type, _timestamp, _pg_lsn and _pg_xid columns. The docs say changes are batched and flushed about every 15 seconds. A workspace admin must enable the preview, and destination catalogs that use default storage are not supported.',
    links: [
      {
        label: 'Quickstart: Lakebase Change Data Feed',
        url: 'https://docs.databricks.com/aws/en/oltp/projects/quickstart-lakebase-cdf',
      },
      { label: 'Lakebase Postgres overview', url: 'https://docs.databricks.com/aws/en/oltp/projects/' },
    ],
  },
  {
    question: 'How do I register a Lakebase database in Unity Catalog, and what can I do with it?',
    answer:
      'Create a catalog in Catalog Explorer, choose Lakebase Postgres as the type, and pick the project, branch and database. You need CREATE CATALOG on the metastore. The registered catalog is read-only and mirrors schemas, tables and views, so you can govern it and join it with lakehouse data. You can query it only with a serverless SQL warehouse. Each catalog maps to one database, new objects can appear late because of metadata caching, and registering a branched database is not supported.',
    links: [
      {
        label: 'Register a Lakebase database in Unity Catalog',
        url: 'https://docs.databricks.com/aws/en/oltp/projects/register-uc',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'When should I create a branch for my app?',
    answer:
      'Create a branch for development, staging, testing or a per-developer copy, and keep production on the default branch. Branch creation is instant because a branch shares its parent storage and writes new data only when you change it. Changes in a child do not reach the parent, including roles, databases and permissions, so you move schema changes with your normal migration tools. You can reset a child from its parent. You can also branch from a point in time within the restore window to recover or audit data.',
    links: [{ label: 'Branches', url: 'https://docs.databricks.com/aws/en/oltp/projects/branches' }],
  },
  {
    kind: 'tradeoff',
    question: 'What do branches cost, and when does a branch get expensive?',
    answer:
      'Branches that expire are billed for the data you change on them, and permanent branches are billed for their full data size like an independent database. The branches page warns that making a branch permanent means paying for its full size. So give test and per-developer branches an expiration. Protected branches skip deletion, reset and automatic archival, and a project can have one. The page says the default branch does not count toward the concurrent active compute limit.',
    links: [{ label: 'Branches', url: 'https://docs.databricks.com/aws/en/oltp/projects/branches' }],
  },
  {
    question: 'Can I define Lakebase and the app together in Declarative Automation Bundles?',
    answer:
      'Yes. Bundles support postgres_project, postgres_branch and postgres_endpoint resources, added with Databricks CLI 0.287.0 on February 5, 2026. They are in Beta. The older database_instance, database_catalog and synced_database_table resources also exist. An app can reference a database through its resources block. The bundle reference points to the REST API objects for their fields. Defining catalogs in a bundle requires the direct deployment engine.',
    links: [{ label: 'Bundle resources', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources' }],
  },
  {
    question: 'Can I use pgvector and other Postgres extensions?',
    answer:
      'Yes. pgvector is available on Postgres 16, 17 and 18, at version 0.8.0 for 16 and 17 and 0.8.6 for 18, with ivfflat and hnsw indexes. Install supported extensions with CREATE EXTENSION, and add IF NOT EXISTS so reruns do not fail. The docs list more than 60 extensions, including PostGIS and pgcrypto. When Lakebase releases a new extension version, the compute must restart before you can install or update to it. If scale to zero is off, restart the compute yourself.',
    links: [{ label: 'Postgres extensions', url: 'https://docs.databricks.com/aws/en/oltp/projects/extensions' }],
  },
  {
    kind: 'tradeoff',
    question: 'What do I accept by keeping app data in Lakebase and analytics data in Delta?',
    answer:
      'You get fast transactional access plus governed analytics, and you take on two stores to keep in step. Synced tables push lakehouse data toward Postgres, and Change Data Feed (Public Preview) sends Postgres changes back to Delta. Each direction has its own freshness, cost and permission setup. Lakebase is pay as you go with a 14-day free trial, and the pricing calculator gives the numbers.',
    links: [
      { label: 'Lakebase pricing', url: 'https://www.databricks.com/product/pricing/lakebase' },
      { label: 'Lakebase use cases', url: 'https://docs.databricks.com/aws/en/oltp/projects/use-cases' },
    ],
  },
];
