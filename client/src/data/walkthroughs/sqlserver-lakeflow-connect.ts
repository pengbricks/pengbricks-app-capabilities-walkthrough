import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'sqlserver-lakeflow-connect',
  area: 'Ingestion',
  title: 'SQL Server connections with Lakeflow Connect',
  intro:
    'Lakeflow Connect ingests SQL Server tables into Unity Catalog with two managed pipelines and no extract code. The ingestion gateway runs on classic compute in your workspace network and reads CDC or Change Tracking from SQL Server. The ingestion pipeline runs on serverless compute and applies the staged changes to bronze tables. Credentials live in a Unity Catalog connection. This page covers the questions customers ask, the source setup, the connection, the wizard, live changes, day-two operations, silver with lineage and Genie, and the same pipeline as a bundle in Git. The gateway needs classic compute, so run it in a workspace that allows classic compute.',
  businessValue: {
    summary:
      'Lakeflow Connect replicates SQL Server tables into Unity Catalog with managed pipelines and no extract code. Reports read from the lakehouse instead of the production database, and the DBA setup on the source is the longest lead-time item.',
    outcomes: [
      {
        title: 'No extract code to maintain',
        body: 'Databricks runs the ingestion gateway and the ingestion pipeline. Your team configures them and does not write or patch an extraction job.',
      },
      {
        title: 'Reporting leaves the source',
        body: 'Changes land in bronze Delta tables, so analysts and dashboards query the Delta copy instead of the production SQL Server.',
      },
      {
        title: 'History depth chosen per table',
        body: 'CDC keeps every version of a row (SCD type 2) for audit needs. Change Tracking keeps only the latest row and is lighter. Pick per table.',
      },
      {
        title: 'Plan for DBA lead time',
        body: 'The DBA setup has the longest lead time, and the gateway needs classic compute. Start the DBA work first and confirm the workspace allows classic compute.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Two pipelines, two kinds of compute.',
      body: 'The gateway runs on classic compute, always on, and is the only part that reaches SQL Server. The ingestion pipeline is serverless and triggered on a schedule.',
    },
    {
      title: 'Choose Change Tracking or CDC per table.',
      body: 'Change Tracking is lighter and needs a primary key; it keeps the latest row (SCD type 1). CDC keeps every version (SCD type 2) and works without a primary key. Never enable both on one table.',
    },
    {
      title: 'The DBA work comes first.',
      body: 'A login, the Databricks utility objects script, the setup procedures, and CDC retention. It has the longest lead time, so start it first.',
    },
    {
      title: 'Open one network path.',
      body: 'TCP 1433 from the workspace compute subnets to the primary, plus the workspace storage endpoints for staging. TLS is validated against public CAs unless you supply the CA certificate.',
    },
    {
      title: 'The gateway needs classic compute.',
      body: 'A workspace that allows only serverless compute rejects the gateway. Allow classic compute for the gateway; the ingestion pipeline stays serverless.',
    },
    {
      title: 'An integrated CDC pipeline has no gateway.',
      body: 'It runs extraction and apply in one pipeline update, on serverless or classic compute. The feature is enabled per workspace by your account team, and you create it through the API, CLI, or a bundle.',
    },
    {
      title: 'Keep the gateway running and history safe.',
      body: 'A gateway down longer than the source retention means a full refresh. A full refresh of an SCD type 2 table restarts its history, so keep auto full refresh off on history tables.',
    },
  ],
  sections: [
    {
      id: 'questions',
      heading: 'Questions to answer first',
      prose:
        'Answer these before you build. Most of them decide the setup: which tables get CDC, what the network team opens, and who owns the gateway.',
      table: {
        columns: ['Question', 'Answer'],
        rows: [
          [
            'Does SQL Server have to be on the internet?',
            'No. Only the gateway connects, from the workspace network. VNet or VPC peering, ExpressRoute, Direct Connect, VPN, a private endpoint, or a firewall rule on a public endpoint all work.',
          ],
          [
            'Which SQL Server versions and platforms?',
            'SQL Server 2012 or later on-premises or on a VM, Azure SQL Database, Azure SQL Managed Instance, and Amazon RDS. CDC needs 2012 SP1 CU3 or later, and Enterprise edition before 2016.',
          ],
          [
            'How much load does it put on the source?',
            'After the first snapshot, the gateway reads the change tables, not the base tables. Change Tracking is lighter than CDC. Run the first load outside peak hours.',
          ],
          [
            'Can it read from a replica?',
            'No. Connect to the primary. On an Always On Availability Group, connect through the listener.',
          ],
          [
            'Are deletes captured?',
            'Yes. With SCD type 1 the row is removed from bronze. With SCD type 2 the current version is closed with an end time.',
          ],
          [
            'Can we keep history?',
            'Yes, per table: enable CDC on the source and set SCD type 2. Bronze gets __START_AT and __END_AT on every version.',
          ],
          [
            'What happens when someone adds a column?',
            'The next run adds it to bronze, provided DDL capture is installed. Renames and type changes need a full refresh of that table.',
          ],
          [
            'Where do the credentials live?',
            'In a Unity Catalog connection. Pipelines name the connection; nobody sees the password, and USE CONNECTION controls who can build on it.',
          ],
          [
            'How fresh is the data?',
            'The gateway reads continuously. Bronze is as fresh as the ingestion schedule: every 30 minutes in the reference bundle, at least 5 minutes apart.',
          ],
          [
            'What does it cost?',
            'DBUs only: the gateway on classic compute, around the clock, and the serverless ingestion pipeline per run. There is no per-row fee.',
          ],
          [
            'What if the gateway goes down?',
            'It resumes from where it stopped, as long as the source still has the changes. Past the CDC or Change Tracking retention, the affected tables need a full refresh.',
          ],
          [
            'How many tables?',
            'Up to 250 tables per ingestion pipeline, and one gateway per ingestion pipeline. Split larger databases across pipelines.',
          ],
        ],
      },
      links: [
        {
          label: 'SQL Server connector FAQ',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-faq',
        },
        {
          label: 'SQL Server connector limitations',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-limits',
        },
      ],
    },
    {
      id: 'how-it-works',
      heading: 'How it works: a gateway and a pipeline',
      prose:
        'Both pipelines are managed by Databricks. The gateway stages changes in a Unity Catalog volume; the ingestion pipeline reads that volume, never SQL Server, so it needs no network path to the source.',
      diagram: {
        type: 'flow',
        title: 'SQL Server to bronze',
        description:
          'The ingestion gateway, on classic compute, connects to SQL Server over TCP 1433 with TLS, using the credentials in the Unity Catalog connection. It stages change data in a Unity Catalog volume. The serverless ingestion pipeline applies the staged changes to bronze tables on a schedule. Silver tables and a Genie Agent read from bronze.',
        nodes: [
          {
            id: 'src',
            label: 'SQL Server',
            sub: 'CDC + Change Tracking',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'neutral',
            detail:
              'The source. CDC and Change Tracking are enabled per table, and only the gateway connects, always to the primary.',
          },
          {
            id: 'conn',
            label: 'UC connection',
            sub: 'host, login, TLS',
            col: 0,
            row: 1,
            icon: 'network',
            domain: 'governance',
            detail:
              'Holds the host, login, and TLS settings. Nobody sees the password, and USE CONNECTION controls who can build pipelines on it.',
          },
          {
            id: 'gw',
            label: 'Ingestion gateway',
            sub: 'classic, always on',
            col: 1,
            row: 0,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'data',
            detail:
              'Runs on classic compute, always on, and is the only part that reaches SQL Server. It reads change data and stages it in a volume.',
          },
          {
            id: 'vol',
            label: 'Staging volume',
            sub: 'purged after 30 days',
            col: 2,
            row: 0,
            kind: 'store',
            icon: 'data-file',
            domain: 'data',
            detail:
              'A Unity Catalog volume of staged changes. The ingestion pipeline reads it, so the pipeline needs no network path to SQL Server.',
          },
          {
            id: 'ing',
            label: 'Ingestion pipeline',
            sub: 'serverless, triggered',
            col: 3,
            row: 0,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'data',
            detail:
              'A serverless, triggered pipeline that applies inserts, updates, deletes, and history from the staging volume to bronze.',
          },
          {
            id: 'sched',
            label: 'Schedule job',
            sub: 'every 30 minutes',
            col: 3,
            row: 1,
            icon: 'workflow',
            domain: 'orchestration',
            detail:
              'Triggers the ingestion pipeline, here every 30 minutes and at least 5 minutes apart. Bronze is as fresh as this schedule.',
          },
          {
            id: 'bronze',
            label: 'Bronze tables',
            sub: 'SCD type 1 or 2',
            col: 4,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Delta tables the pipeline creates and owns. SCD type 1 keeps the latest row, and SCD type 2 adds __START_AT and __END_AT to every version.',
          },
          {
            id: 'silver',
            label: 'Silver and Genie',
            sub: 'lineage from bronze',
            col: 4,
            row: 1,
            kind: 'surface',
            icon: 'data-model',
            domain: 'apps',
            detail:
              'Materialized views over bronze, with lineage recorded in Unity Catalog. A Genie Agent over silver answers business questions.',
          },
        ],
        edges: [
          { from: 'src', to: 'gw', label: 'TCP 1433, TLS' },
          { from: 'conn', to: 'gw', dashed: true },
          { from: 'gw', to: 'vol' },
          { from: 'vol', to: 'ing' },
          { from: 'sched', to: 'ing', dashed: true },
          { from: 'ing', to: 'bronze' },
          { from: 'bronze', to: 'silver' },
        ],
        legend: [
          { kind: 'highlight', label: 'Managed pipeline' },
          { kind: 'store', label: 'Data' },
        ],
      },
      table: {
        columns: ['', 'Gateway / ingestion pipeline'],
        rows: [
          [
            'Job',
            'Gateway: reads change data and stages it in a volume. Pipeline: applies inserts, updates, deletes, and history to bronze.',
          ],
          [
            'Compute',
            'Gateway: classic compute in the workspace network, continuous, driver with at least 8 cores. Pipeline: serverless, triggered.',
          ],
          [
            'Network',
            'Gateway: must reach SQL Server on its port (1433 by default) and the workspace storage. Pipeline: no path to SQL Server.',
          ],
        ],
      },
      points: [
        {
          strong: "Don't stop the gateway to save cost.",
          text: "If it is down longer than the source's CDC or Change Tracking retention, changes age out of SQL Server and the affected tables need a full refresh.",
        },
        {
          strong: 'Stopping it is a demo-only cost control.',
          text: 'In a short-lived demo environment you can stop the gateway between sessions, but only for less than the source CDC or Change Tracking retention. Do not do it in production. The Run it tab has a button for the demo cluster.',
        },
        {
          strong: 'Limits.',
          text: 'One gateway per ingestion pipeline, up to 250 tables per pipeline, and staged change data is purged after 30 days.',
        },
        {
          strong: 'Prerequisite: classic compute.',
          text: 'The gateway runs on classic compute. A workspace that allows only serverless compute rejects it with "Only serverless compute is supported in the workspace", so enable classic compute, or use an integrated CDC pipeline if your workspace has it.',
        },
      ],
      links: [
        {
          label: 'SQL Server connector overview',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-overview',
        },
      ],
    },
    {
      id: 'integrated',
      heading: 'Integrated CDC pipeline: no gateway',
      prose:
        'An integrated CDC pipeline replaces the gateway and ingestion pipeline with one pipeline. Each update extracts changes from SQL Server into a staging volume, applies them to streaming tables, and stops when it catches up, bounded by a maximum runtime. Schedule it with a Lakeflow Jobs task.',
      points: [
        {
          strong: 'Compute.',
          text: 'It can run on serverless or classic compute. Serverless needs serverless network connectivity from Databricks to the source database.',
        },
        {
          strong: 'Availability.',
          text: 'The feature is gated: ask your Databricks account team to enable it for the workspace.',
        },
        {
          strong: 'Authoring.',
          text: 'It is API-only for now: create it with the REST API, the CLI, a notebook, or a bundle. UI creation is not yet available. The pipeline references a Unity Catalog connection with connection_name and sets connector_type to CDC.',
        },
        {
          strong: 'Source limits.',
          text: 'It reads the primary instance only, not read replicas or secondary instances. SCD type 2 needs SQL Server CDC on the source and is not supported with Change Tracking.',
        },
        {
          strong: 'When to choose it.',
          text: 'Pick it when you want to avoid an always-on classic gateway and its cost, and a scheduled catch-up fits your freshness target. Pick the gateway for continuous capture.',
        },
      ],
      options: {
        caption: 'Gateway or integrated CDC pipeline',
        rows: [
          {
            option: 'Gateway plus ingestion pipeline',
            when: 'You need continuous capture, or you create pipelines in the UI.',
            tradeoffs:
              'The gateway reads changes around the clock, so bronze is as fresh as the ingestion schedule. It runs on classic compute all the time, which is a standing DBU cost, and it needs a network path to SQL Server. Do not stop it to save money, because changes can age out of the source. Limits are one gateway per pipeline and 250 tables per pipeline.',
          },
          {
            option: 'Integrated CDC pipeline',
            when: 'You want no always-on classic gateway, and a scheduled catch-up meets your freshness target.',
            tradeoffs:
              'One pipeline per source extracts changes on each update and stops when it catches up, so compute is billed per run. It can run on serverless, which then needs serverless network connectivity to the source. Freshness is bounded by the schedule. The feature is gated, so your account team must enable it, and it is API-only for now.',
          },
        ],
        recommendation:
          'Use the gateway when you need continuous capture or UI setup. Use the integrated pipeline when scheduled catch-up is enough and you want to avoid an always-on classic gateway, once it is enabled for your workspace.',
      },
      links: [
        {
          label: 'Integrated CDC pipeline for SQL Server',
          url: 'https://learn.microsoft.com/en-us/azure/databricks/ingestion/lakeflow-connect/sql-server-integrated-pipeline',
        },
      ],
    },
    {
      id: 'ct-or-cdc',
      heading: 'Change Tracking or CDC, decided per table',
      prose:
        'Change Tracking is the default for tables with a primary key that only need the latest row. Use CDC for tables that need history or have no primary key.',
      options: {
        caption: 'Change Tracking against CDC, per table',
        rows: [
          {
            option: 'Change Tracking',
            when: 'The table has a primary key and you only need the latest row (SCD type 1).',
            tradeoffs:
              'Lighter on the source than CDC and works on SQL Server 2012 or later. It requires a primary key and does not support SCD type 2. Its data is not replicated, so an Always On failover needs a full refresh of the table.',
          },
          {
            option: 'CDC',
            when: 'The table needs history (SCD type 2) or has no primary key.',
            tradeoffs:
              'Works without a primary key, supports SCD type 2, and resumes through the Availability Group listener after a failover. It needs SQL Server 2012 SP1 CU3 or later, with Enterprise edition before 2016, and puts more work on the source because SQL Server maintains change tables.',
          },
        ],
        recommendation:
          'Use Change Tracking for keyed tables that only need the latest row, and CDC for tables that need history or have no key. If a table has both enabled, the connector uses Change Tracking, so leave it off on tables you want as SCD type 2.',
      },
      examples: [
        {
          label: 'One account, three changes, two results',
          language: 'text',
          code: `Changes in SQL Server
__op     __commit_ts       account_id  plan      status
INSERT   2019-04-03 09:00  9001234     Standard  ACTIVE
UPDATE   2025-06-04 10:00  9001234     Premium   ACTIVE
UPDATE   2026-02-28 17:00  9001234     Premium   CLOSED

SCD type 1 (Change Tracking or CDC): the latest row
account_id  plan     status
9001234     Premium  CLOSED

SCD type 2 (CDC only): every version and when it was true
account_id  plan      status  __START_AT        __END_AT
9001234     Standard  ACTIVE  2019-04-03 09:00  2025-06-04 10:00
9001234     Premium   ACTIVE  2025-06-04 10:00  2026-02-28 17:00
9001234     Premium   CLOSED  2026-02-28 17:00  null (current)`,
          notes: [
            "SCD type 1 is fine for transactional tables, but you can't tell that this customer was on Standard for six years, or when they switched.",
            'SCD type 2 is what point-in-time reporting and as-of features need.',
          ],
        },
      ],
      points: [
        {
          strong: 'If a table has both Change Tracking and CDC enabled, the connector uses Change Tracking.',
          text: 'For any table you want as SCD type 2, or for the whole schema with "ingest all", enable CDC and leave Change Tracking off on that table.',
        },
        {
          strong: 'Connect to the primary.',
          text: 'Read replicas and secondaries are not supported. On an Availability Group, connect through the listener.',
        },
      ],
      links: [
        {
          label: 'Prepare SQL Server for ingestion',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-source-setup',
        },
        {
          label: 'SQL Server connector overview',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-overview',
        },
        {
          label: 'History tracking (SCD type 2)',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/scd',
        },
      ],
    },
    {
      id: 'dba-setup',
      heading: 'SQL Server setup: the DBA checklist',
      prose:
        'Nine steps across four roles. The DBA work comes first and has the longest lead time. The reference bundle includes a script for the DBA steps.',
      diagram: {
        type: 'flow',
        title: 'Who does what, in order',
        description:
          'The DBA creates the login, runs the utility objects script as db_owner, runs the CDC and Change Tracking setup procedures, and fixes permissions and CDC retention. The network team opens the path on port 1433 and to storage. The Databricks admin creates the Unity Catalog connection, grants USE CONNECTION, and sets a gateway cluster policy with an 8-core driver. The data engineer sets the bundle variables and deploys and runs the gateway and the schedule.',
        lanes: [
          { label: 'DBA', fromRow: 0, toRow: 0 },
          { label: 'Network / cloud team', fromRow: 1, toRow: 1 },
          { label: 'Databricks admin', fromRow: 2, toRow: 2 },
          { label: 'Data engineer', fromRow: 3, toRow: 3 },
        ],
        nodes: [
          {
            id: 'login',
            label: '1 · Login + user',
            sub: 'lakeflow_ingest',
            col: 0,
            row: 0,
            icon: 'id-provider',
            domain: 'governance',
            detail:
              'A dedicated login and database user such as lakeflow_ingest. Its password is stored only in the Unity Catalog connection.',
          },
          {
            id: 'util',
            label: '2 · utility_script.sql',
            sub: 'as db_owner',
            col: 1,
            row: 0,
            icon: 'database',
            domain: 'neutral',
            detail:
              'A db_owner runs the Databricks utility objects script in the database you will ingest. The setup procedures that follow depend on it.',
          },
          {
            id: 'capture',
            label: '3 · CDC / CT setup',
            sub: 'procedures',
            col: 2,
            row: 0,
            icon: 'event-stream',
            domain: 'neutral',
            detail:
              'CDC for history tables, Change Tracking for latest-row tables, never both on one table. CDC also installs the DDL trigger used for schema evolution.',
          },
          {
            id: 'perms',
            label: '4 · Fix permissions',
            sub: '+ CDC retention',
            col: 3,
            row: 0,
            icon: 'checklist',
            domain: 'governance',
            detail:
              'Grants the ingestion user what the connector reads and sets CDC retention. Size retention to your longest tolerable gateway outage.',
          },
          {
            id: 'net',
            label: '5 · Network path',
            sub: '1433 + storage',
            col: 1,
            row: 1,
            icon: 'cloud-network',
            domain: 'neutral',
            detail:
              'Opens the path from workspace compute to SQL Server on port 1433 and to the workspace storage endpoints. The network team owns this step.',
          },
          {
            id: 'conn',
            label: '6 · UC connection',
            sub: '+ USE CONNECTION grant',
            col: 3,
            row: 2,
            icon: 'network',
            domain: 'governance',
            detail:
              'The Databricks admin creates the Unity Catalog connection and grants USE CONNECTION to the people who deploy the pipelines.',
          },
          {
            id: 'policy',
            label: '7 · Gateway policy',
            sub: '>= 8-core driver',
            col: 4,
            row: 2,
            icon: 'gear-navy',
            domain: 'governance',
            detail:
              'A gateway cluster policy whose driver has at least 8 cores, which the classic compute gateway needs when a policy is enforced.',
          },
          {
            id: 'vars',
            label: '8 · Bundle variables',
            sub: 'connection, database',
            col: 4,
            row: 3,
            domain: 'orchestration',
            detail: 'The data engineer sets the bundle variables, such as the connection name and the source database.',
          },
          {
            id: 'deploy',
            label: '9 · Deploy + run',
            sub: 'gateway, schedule',
            col: 5,
            row: 3,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'orchestration',
            detail:
              'Deploys the bundle and starts the gateway, which runs continuously. Unpause the schedule after the first successful run.',
          },
        ],
        edges: [
          { from: 'login', to: 'util' },
          { from: 'util', to: 'capture' },
          { from: 'capture', to: 'perms' },
          { from: 'util', to: 'net' },
          { from: 'net', to: 'conn' },
          { from: 'perms', to: 'conn' },
          { from: 'conn', to: 'policy' },
          { from: 'policy', to: 'vars' },
          { from: 'vars', to: 'deploy' },
        ],
      },
      steps: [
        {
          title: 'Create a dedicated login and database user',
          body: 'For example lakeflow_ingest. Use a strong password and store it only in the Unity Catalog connection. The setup user needs db_owner only to run the script.',
          code: `USE [<database>];
ALTER ROLE db_owner ADD MEMBER [your_setup_user];
GO`,
        },
        {
          title: 'Install the utility objects',
          body: 'A db_owner runs the Databricks utility objects script (utility_script.sql) in the database you will ingest. Download it from the utility objects page.',
          code: `-- Windows auth
sqlcmd -S <server> -d <database> -E -i utility_script.sql
-- SQL auth
sqlcmd -S <server> -d <database> -U <setup_user> -P <password> -i utility_script.sql

-- Verify
SELECT dbo.lakeflowUtilityVersion() AS UtilityVersion;
SELECT dbo.lakeflowDetectPlatform() AS Platform;  -- ON_PREMISES | AZURE_SQL_DATABASE | AZURE_SQL_MANAGED_INSTANCE | AMAZON_RDS`,
        },
        {
          title: 'CDC for the history (SCD type 2) tables',
          body: 'The procedure enables CDC on the database and tables, creates the capture instances (lakeflow_<schema>_<table>_1), and installs the DDL trigger the connector uses for schema evolution. SQL Server allows two capture instances per table; keep one slot free, or Lakeflow cannot run a full refresh or evolve that table.',
          code: `-- Tables that need history (SCD type 2)
EXEC dbo.lakeflowSetupChangeDataCapture
     @Tables = 'dbo.<history_table_1>,dbo.<history_table_2>',
     @User   = 'lakeflow_ingest';

-- Or, for "ingest all" with SCD type 2 on every table
EXEC dbo.lakeflowSetupChangeDataCapture @Tables = 'SCHEMAS:dbo', @User = 'lakeflow_ingest';

-- CDC cleanup retention, in minutes (20160 = 14 days). Size it to your longest tolerable gateway outage.
EXEC sys.sp_cdc_change_job @job_type = N'cleanup', @retention = 20160;`,
        },
        {
          title: 'Change Tracking for the SCD type 1 tables',
          body: 'Skip this if you use "ingest all" with SCD type 2 for the whole schema. Don\'t enable Change Tracking on the CDC tables from the previous step.',
          code: `EXEC dbo.lakeflowSetupChangeTracking
     @Tables    = 'dbo.<table_1>,dbo.<table_2>,dbo.<table_3>',
     @User      = 'lakeflow_ingest',
     @Retention = '3 DAYS',
     @CreateDdlSupportingObjects = 1;  -- capture DDL so new columns flow through`,
        },
        {
          title: 'Grant the ingestion user what it needs',
          body: 'The procedure grants the catalog views, system procedures, and table SELECT the connector reads. The manual equivalents per platform are below.',
          code: `EXEC dbo.lakeflowFixPermissions
     @User   = 'lakeflow_ingest',
     @Tables = 'SCHEMAS:dbo';`,
        },
        {
          title: 'Open the network path and hand over the details',
          body: 'Open the path from the workspace compute to SQL Server (next section). Send the Databricks team the host, port, database name, login, and whether TLS uses a public or a private CA.',
        },
      ],
      examples: [
        {
          label: 'Manual grants: SQL Server on-premises or on a VM',
          language: 'sql',
          code: `-- In master
GRANT VIEW ANY DATABASE TO lakeflow_ingest;
GRANT SELECT ON object::sys.databases TO lakeflow_ingest;
GRANT SELECT ON object::sys.schemas TO lakeflow_ingest;
GRANT SELECT ON object::sys.tables TO lakeflow_ingest;
GRANT SELECT ON object::sys.columns TO lakeflow_ingest;
GRANT SELECT ON object::sys.key_constraints TO lakeflow_ingest;
GRANT SELECT ON object::sys.foreign_keys TO lakeflow_ingest;
GRANT SELECT ON object::sys.check_constraints TO lakeflow_ingest;
GRANT SELECT ON object::sys.default_constraints TO lakeflow_ingest;
GRANT SELECT ON object::sys.change_tracking_tables TO lakeflow_ingest;
GRANT SELECT ON object::sys.change_tracking_databases TO lakeflow_ingest;
GRANT SELECT ON object::sys.objects TO lakeflow_ingest;
GRANT SELECT ON object::sys.views TO lakeflow_ingest;
GRANT SELECT ON object::sys.triggers TO lakeflow_ingest;
GRANT EXECUTE ON object::sp_tables TO lakeflow_ingest;
GRANT EXECUTE ON object::sp_columns_100 TO lakeflow_ingest;
GRANT EXECUTE ON object::sp_pkeys TO lakeflow_ingest;
GRANT EXECUTE ON object::sp_statistics_100 TO lakeflow_ingest;
GRANT VIEW SERVER STATE TO lakeflow_ingest;  -- lets the connector check SQL Server Agent status (CDC)

-- In the ingested database
USE <database>;
GRANT VIEW DATABASE STATE TO lakeflow_ingest;  -- SQL Server 2022+: VIEW DATABASE PERFORMANCE STATE
GRANT SELECT ON schema::dbo TO lakeflow_ingest;
GRANT SELECT ON schema::cdc TO lakeflow_ingest;
GRANT SELECT ON object::sys.indexes TO lakeflow_ingest;
GRANT SELECT ON object::sys.index_columns TO lakeflow_ingest;
GRANT SELECT ON object::sys.columns TO lakeflow_ingest;
GRANT SELECT ON object::sys.tables TO lakeflow_ingest;
GRANT SELECT ON object::sys.fulltext_index_columns TO lakeflow_ingest;
GRANT SELECT ON object::sys.fulltext_indexes TO lakeflow_ingest;`,
        },
        {
          label: 'Manual grants: Azure SQL Database',
          language: 'sql',
          code: `-- In master
ALTER ROLE ##MS_DatabaseConnector## ADD MEMBER lakeflow_ingest;

-- In the ingested database: catalog views (repeat for each name below)
--   schemas, tables, columns, key_constraints, foreign_keys, check_constraints, default_constraints,
--   change_tracking_tables, objects, triggers, indexes, index_columns, fulltext_index_columns, fulltext_indexes
GRANT SELECT ON object::sys.schemas TO lakeflow_ingest;
GRANT SELECT ON object::sys.tables  TO lakeflow_ingest;
-- ...
GRANT VIEW DATABASE STATE TO lakeflow_ingest;
GRANT SELECT ON schema::dbo TO lakeflow_ingest;
GRANT SELECT ON schema::cdc TO lakeflow_ingest;`,
          notes: [
            'No EXECUTE grants are needed on Azure SQL Database. Microsoft Entra ID authentication is supported.',
          ],
        },
        {
          label: 'Manual grants: Azure SQL Managed Instance and Amazon RDS',
          language: 'sql',
          code: `-- In master
GRANT VIEW ANY DATABASE TO lakeflow_ingest;
GRANT SELECT ON sys.databases TO lakeflow_ingest;
GRANT SELECT ON object::sys.change_tracking_databases TO lakeflow_ingest;
GRANT EXECUTE ON object::sp_tables TO lakeflow_ingest;
GRANT EXECUTE ON object::sp_columns_100 TO lakeflow_ingest;
GRANT EXECUTE ON object::sp_pkeys TO lakeflow_ingest;
GRANT EXECUTE ON object::sp_statistics_100 TO lakeflow_ingest;

-- In the ingested database: the same catalog-view SELECTs as Azure SQL Database, plus
GRANT VIEW DATABASE STATE TO lakeflow_ingest;
GRANT SELECT ON schema::dbo TO lakeflow_ingest;
GRANT SELECT ON schema::cdc TO lakeflow_ingest;`,
        },
      ],
      links: [
        {
          label: 'Utility objects script',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-utility',
        },
        {
          label: 'Utility procedure reference',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-utility-reference',
        },
        {
          label: 'Database user privileges',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-privileges',
        },
      ],
    },
    {
      id: 'networking',
      heading: 'Network path and TLS',
      prose:
        'Only the gateway needs a route to SQL Server. Any route works, as long as it reaches the primary on its port from the workspace compute subnets.',
      diagram: {
        type: 'flow',
        title: 'Routes from each SQL Server platform to the gateway',
        description:
          'SQL Server on-premises or on a VM connects through ExpressRoute, Direct Connect, or VPN. Azure SQL Database connects through a private endpoint in a peered network or a firewall rule for the workspace egress addresses. Azure SQL Managed Instance connects through network peering or a private endpoint. Amazon RDS connects through VPC peering or a security group rule. Each route reaches the ingestion gateway on TCP 1433 with TLS, and the gateway writes staged changes to the workspace storage.',
        lanes: [{ label: 'Your network', fromRow: 0, toRow: 3 }],
        nodes: [
          {
            id: 'onprem',
            label: 'SQL Server (primary)',
            sub: 'on-prem or VM, AG listener',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'neutral',
            detail:
              'SQL Server on-premises or on a VM, reached on the primary or the Always On listener over ExpressRoute, Direct Connect, or VPN.',
          },
          {
            id: 'azsql',
            label: 'Azure SQL Database',
            sub: 'logical server',
            col: 0,
            row: 1,
            kind: 'store',
            icon: 'cloud-database',
            domain: 'neutral',
            detail:
              'Reached through a private endpoint in a peered network, or through a firewall rule for the workspace egress addresses.',
          },
          {
            id: 'mi',
            label: 'Azure SQL MI',
            sub: 'VNet-local endpoint',
            col: 0,
            row: 2,
            kind: 'store',
            icon: 'cloud-database',
            domain: 'neutral',
            detail: 'Has a VNet-local endpoint, reached through network peering or a private endpoint.',
          },
          {
            id: 'rds',
            label: 'Amazon RDS',
            sub: 'SQL Server engine',
            col: 0,
            row: 3,
            kind: 'store',
            icon: 'cloud-database',
            domain: 'neutral',
            detail: 'SQL Server on Amazon RDS, reached through VPC peering and a security group rule on port 1433.',
          },
          {
            id: 'er',
            label: 'ExpressRoute or VPN',
            sub: 'or Direct Connect',
            col: 1,
            row: 0,
            icon: 'cloud-network',
            domain: 'neutral',
            detail:
              'A private route to the workspace network. Any route works if it reaches the primary on its port from the workspace compute subnets.',
          },
          {
            id: 'pe',
            label: 'Private endpoint',
            sub: 'or firewall rule',
            col: 1,
            row: 1,
            icon: 'cloud-network',
            domain: 'neutral',
            detail:
              'A private endpoint, or a firewall rule on a public endpoint that allows the workspace egress addresses.',
          },
          {
            id: 'peer',
            label: 'Network peering',
            sub: 'or private endpoint',
            col: 1,
            row: 2,
            icon: 'cloud-network',
            domain: 'neutral',
            detail: 'Network peering or a private endpoint gives the gateway a route to the managed instance.',
          },
          {
            id: 'sg',
            label: 'VPC peering',
            sub: 'security group on 1433',
            col: 1,
            row: 3,
            icon: 'cloud-network',
            domain: 'neutral',
            detail: 'VPC peering plus a security group rule that allows TCP 1433 from the workspace compute subnets.',
          },
          {
            id: 'gw',
            label: 'Ingestion gateway',
            sub: 'workspace compute subnets',
            col: 2,
            row: 1,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'data',
            detail:
              'Connects to SQL Server on TCP 1433 with TLS from the workspace compute subnets, and writes staged changes to workspace storage.',
          },
          {
            id: 'storage',
            label: 'Workspace storage',
            sub: 'staging volume',
            col: 3,
            row: 1,
            kind: 'store',
            icon: 'data-file',
            domain: 'data',
            detail:
              'Workspace storage holds the staging volume. Allow its endpoints: DFS and blob on Azure, the S3 bucket on AWS.',
          },
        ],
        edges: [
          { from: 'onprem', to: 'er' },
          { from: 'azsql', to: 'pe' },
          { from: 'mi', to: 'peer' },
          { from: 'rds', to: 'sg' },
          { from: 'er', to: 'gw' },
          { from: 'pe', to: 'gw', label: 'TCP 1433, TLS' },
          { from: 'peer', to: 'gw' },
          { from: 'sg', to: 'gw' },
          { from: 'gw', to: 'storage' },
        ],
      },
      points: [
        {
          strong: 'The gateway opens the connection.',
          text: "It runs on classic compute in the workspace's network: VNet peering, ExpressRoute or VPN to on-premises, a private endpoint, or a firewall rule on a public endpoint.",
        },
        {
          strong: 'Allow TCP to the SQL Server port',
          text: '(1433 unless changed) from the workspace compute subnets, or from the workspace egress addresses for a public endpoint.',
        },
        {
          strong: 'Allow the storage endpoints.',
          text: 'The gateway writes staged changes to the workspace storage: the DFS and blob endpoints on Azure, the S3 bucket on AWS.',
        },
        {
          strong: 'Multi-subnet failover clusters',
          text: 'must present a single forward-facing IP.',
        },
        {
          strong: 'TLS:',
          text: 'the server certificate is validated against public CAs. For a private CA, supply the CA certificate (userProvidedServerCertificate) on the connection. trustServerCertificate skips validation, so use it only in development.',
        },
      ],
      links: [
        {
          label: 'Troubleshooting',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-troubleshoot',
        },
        {
          label: 'TLS certificate validation',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/tls-server-certificate-validation',
        },
      ],
    },
    {
      id: 'connection',
      heading: 'Create the SQL Server connection in Unity Catalog',
      prose:
        'Credentials live in a governed Unity Catalog connection, not in pipeline code. In Catalog Explorer: Catalog, then Connect, Connections, Create connection, type SQL Server, then host, port, user, and password. The connection holds only the credential. The gateway that uses it runs on classic compute, and nothing about the connection itself is tied to a compute type.',
      examples: [
        {
          label: 'Create the connection with the CLI',
          language: 'bash',
          code: `databricks connections create --profile <profile> --json '{
  "name": "sqlserver_source",
  "connection_type": "SQLSERVER",
  "options": {
    "host": "<server-fqdn>",
    "port": "1433",
    "user": "lakeflow_ingest",
    "password": "<password>",
    "trustServerCertificate": "false",
    "userProvidedServerCertificate": "<CA certificate in PEM, only for a private CA>"
  }
}'

# Let the data engineers build pipelines on it
databricks grants update connection sqlserver_source --profile <profile> \\
  --json '{"changes": [{"principal": "data-engineers", "add": ["USE_CONNECTION"]}]}'`,
          notes: [
            'Type the password interactively or read it from a secret store; keep it out of shell history and Git.',
            'Catalog Explorer shows the host, port, and login on the connection. The password is never shown again.',
          ],
        },
      ],
      table: {
        columns: ['Who', 'Needs'],
        rows: [
          ['Creates the connection', 'CREATE CONNECTION on the metastore'],
          [
            'Deploys the pipelines',
            'USE CONNECTION on the connection; USE CATALOG; USE SCHEMA, CREATE TABLE, CREATE VOLUME on the target schema (or CREATE SCHEMA on the catalog)',
          ],
        ],
      },
      links: [
        {
          label: 'SQL Server connection',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-connection',
        },
      ],
    },
    {
      id: 'wizard',
      heading: 'Ingestion wizard: gateway plus pipeline',
      prose:
        'The wizard creates both pipelines in one pass. The choice that matters most is per table: history (SCD type 2, needs CDC on the source) or latest row (SCD type 1, Change Tracking is enough).',
      steps: [
        {
          title: 'Start from Data ingestion',
          body: 'Data ingestion, then SQL Server, then pick the Unity Catalog connection. Host, port, and credential come from the connection.',
        },
        {
          title: 'Name the gateway and its staging location',
          body: 'The gateway gets a name and a catalog and schema for its staging volume. It starts on classic compute and keeps running.',
        },
        {
          title: 'Pick the source tables',
          body: 'Select the whole schema for "ingest all" (tables added later are picked up) or tick tables one by one. The wizard shows whether each table has CDC or Change Tracking.',
        },
        {
          title: 'Set history per table',
          body: 'Turn on history tracking (SCD type 2) only for tables with CDC. Optionally rename the destination table or exclude columns that must never land.',
        },
        {
          title: 'Choose the destination',
          body: "Catalog and schema for the bronze tables. The pipeline creates and owns them; don't write to them from anything else.",
        },
        {
          title: 'Schedule and run',
          body: 'Schedule the serverless ingestion pipeline, for example every 30 minutes, at least 5 minutes apart. The first load can take a few runs to land every row.',
        },
      ],
      points: [
        {
          strong: 'In the reference bundle:',
          text: 'customers keeps history with CDC, orders and products keep the latest row with Change Tracking. The YAML below is the same set of choices as code.',
        },
      ],
      links: [
        {
          label: 'Create a SQL Server ingestion pipeline',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-pipeline',
        },
      ],
    },
    {
      id: 'live-changes',
      heading: 'Make live inserts, updates and deletes on the source and show them land',
      prose:
        "Change rows in SQL Server, by hand in SSMS or with the job's 02_make_changes step, then run the ingestion pipeline and query bronze. The job checks every change it made: new orders exist, shipped orders show SHIPPED, deleted orders are gone, and each customer who changed plan has a new current version and a closed old one. The gateway stages changes shortly after they commit, so the check reruns ingestion until everything has landed.",
      examples: [
        {
          label: 'Change rows on the source',
          language: 'sql',
          code: `-- SQL Server: one plan change (history table), one new order, one shipped, one deleted
UPDATE dbo.customers SET plan_name = 'Premium', updated_at = SYSUTCDATETIME() WHERE customer_id = 42;
INSERT INTO dbo.orders (customer_id, product_id, quantity, amount, status, order_ts, updated_at)
VALUES (42, 9, 1, 199.00, 'NEW', SYSUTCDATETIME(), SYSUTCDATETIME());
UPDATE dbo.orders SET status = 'SHIPPED', updated_at = SYSUTCDATETIME() WHERE order_id = 117;
DELETE FROM dbo.orders WHERE order_id = 20;`,
        },
        {
          label: 'Show them in bronze',
          language: 'sql',
          code: `-- Databricks, after the next ingestion run
SELECT customer_id, plan_name, status, __START_AT, __END_AT
FROM <catalog>.<schema>.lfc_customers
WHERE customer_id = 42
ORDER BY __START_AT;            -- the old plan closed, the new one current

SELECT order_id, status FROM <catalog>.<schema>.lfc_orders
WHERE order_id IN (20, 117) OR customer_id = 42 AND status = 'NEW';  -- 20 is gone`,
          notes: ['Dates and times land in UTC.'],
        },
      ],
    },
    {
      id: 'day-two',
      heading: 'Day-two operations: a schema change and a full refresh',
      prose:
        'A column added at the source reaches bronze on the next ingestion run with no pipeline change. A full refresh of one SCD type 1 table leaves the SCD type 2 history tables alone.',
      table: {
        caption: 'Schema changes and what happens',
        columns: ['Source change', 'What happens'],
        rows: [
          [
            'New column',
            'Ingested on the next run (DDL capture must be installed: CDC procedures or @CreateDdlSupportingObjects = 1)',
          ],
          ['Dropped column', 'Kept in bronze, marked inactive'],
          ['New table in the schema', 'Picked up automatically with "ingest all"; otherwise add it to the YAML'],
          ['Column rename or type change', 'Needs a full refresh of that table'],
          ['Truncate, or failover with Change Tracking', 'Needs a full refresh'],
        ],
      },
      points: [
        {
          strong: 'A full refresh erases SCD type 2 history.',
          text: 'It replaces the table, and history restarts from the refresh point. Keep auto full refresh off on history tables, refresh one table at a time with full_refresh_selection, and schedule planned refreshes with full_refresh_window.',
        },
        {
          strong: 'Type mapping worth knowing.',
          text: 'MONEY lands as DECIMAL(19,4), SMALLMONEY as DECIMAL(10,4); TIME, DATETIMEOFFSET, XML, UNIQUEIDENTIFIER, HIERARCHYID, and SQL_VARIANT as STRING; GEOGRAPHY, GEOMETRY, VARBINARY, IMAGE, and ROWVERSION as BINARY. Dates and times land in UTC.',
        },
        {
          strong: 'Filter in silver.',
          text: 'Land the source table whole and filter or mask downstream, or use exclude_columns for columns that must never land.',
        },
      ],
      examples: [
        {
          label: 'Full refresh of one table, from the CLI',
          language: 'bash',
          code: `databricks pipelines start-update <ingestion-pipeline-id> --profile <profile> \\
  --json '{"full_refresh_selection": ["lfc_orders"]}'`,
          notes: ['Name SCD type 1 tables only. Refreshing a history table restarts its history.'],
        },
      ],
      links: [
        {
          label: 'Full refresh',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/full-refresh',
        },
        {
          label: 'Data type reference',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sql-server-reference',
        },
      ],
    },
    {
      id: 'lineage-genie',
      heading: 'Lineage to a Silver table, then a Genie query on it',
      prose:
        'Build silver as materialized views over bronze: current rows, history with validity windows, and facts joined to dimensions. Unity Catalog records lineage from each bronze table to silver; open a silver table in Catalog Explorer and choose the Lineage tab. A Genie Agent over the silver tables can then answer business questions, and you can compare the SQL it writes with a hand-written query.',
      examples: [
        {
          label: 'Read lineage from the system table',
          language: 'sql',
          code: `SELECT DISTINCT source_table_full_name, target_table_full_name, entity_type
FROM system.access.table_lineage
WHERE target_table_full_name LIKE '<catalog>.<schema>.lfc_silver_%'
  AND event_date >= current_date() - INTERVAL 7 DAYS;`,
          notes: ['Lineage system tables can lag by a few hours; Catalog Explorer shows it sooner.'],
        },
        {
          label: 'Ask Genie',
          language: 'text',
          code: 'What is the total revenue and number of orders for each customer plan, excluding cancelled orders?',
          notes: [
            'The space instructions say revenue is the sum of amount and cancelled orders are excluded unless asked.',
          ],
        },
      ],
      links: [
        {
          label: 'Data lineage in Unity Catalog',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage',
        },
        { label: 'Genie Agents', url: 'https://docs.databricks.com/aws/en/genie' },
      ],
    },
    {
      id: 'operate',
      heading: 'Monitoring and run_as',
      points: [
        {
          strong: 'Watch the gateway and the pipeline.',
          text: 'Both write pipeline event logs. Query the gateway event log for connection, snapshot, and replication state, and the ingestion pipeline event log for update results and rows applied. Alert on failed updates and on staging lag.',
        },
        {
          strong: 'Notifications.',
          text: 'Set email or webhook notifications on both pipelines for failures. A failed gateway matters more than a failed update, because it risks the source retention window.',
        },
        {
          strong: 'Monitor cost.',
          text: 'The gateway bills classic compute around the clock and the ingestion pipeline bills serverless per update. Tag both pipelines and report from system.billing.usage.',
        },
        {
          strong: 'Run as a service principal.',
          text: 'Set run_as on the gateway and ingestion pipelines in the bundle so they run as a service principal, not the deploying user. Grant that principal USE CONNECTION on the connection and write access to the target schema and staging volume.',
        },
      ],
      links: [
        {
          label: 'Gateway event logs',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/gateway-event-logs',
        },
        {
          label: 'Monitor ingestion costs',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/monitor-costs',
        },
      ],
    },
    {
      id: 'bundle',
      heading: 'The same pipeline as a bundle in Git',
      prose:
        'Everything the wizard did is a few dozen lines of YAML: the gateway, the ingestion pipeline with SCD type per table, the silver pipeline, and a paused 30-minute schedule. Deploy it to each environment with different variables, review changes in pull requests, and keep the connection out of the repository.',
      examples: [
        {
          label: 'Deploy and run',
          language: 'bash',
          code: `databricks bundle deploy -t dev --profile <profile> \\
  --var catalog=<catalog> --var warehouse_id=<warehouse-id> \\
  --var app_service_principal=<app-sp-application-id> \\
  --var sqlserver_connection_name=sqlserver_source \\
  --var sqlserver_database=<database> --var sqlserver_schema=dbo

databricks bundle run lfc_gateway -t dev --profile <profile> --no-wait     # continuous; leave it running
databricks bundle run capability_guides_lakeflow_connect -t dev --profile <profile>`,
          notes: [
            'capability-guides-lfc-sqlserver-schedule ships paused (every 30 minutes, UTC). Unpause it after the first successful run.',
            'With a cluster policy enforced, pin the gateway to a policy whose driver has at least 8 cores.',
          ],
        },
      ],
      links: [{ label: 'Declarative Automation Bundles', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles' }],
    },
  ],
  related: [
    { slug: 'relational-db-ingestion', title: 'Relational database extracts' },
    { slug: 'cdc-incremental-refresh', title: 'CDC and incremental refresh in pipelines' },
    { slug: 'scd-change-capture', title: 'SCD and change capture' },
  ],
};
