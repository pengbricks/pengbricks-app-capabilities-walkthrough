import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'external-integrations',
  area: 'General Guides',
  title: 'Partner tool integrations',
  intro:
    'Connecting a tool to Databricks starts with a choice of pattern. A SQL warehouse with OAuth serves BI tools and applications. Federation, Lakeflow Connect, and OpenSharing or the Iceberg REST catalog move or expose data from other systems. Partner tools cover the rest of the ecosystem, and Lakebase serves transactional apps. This page helps you pick the pattern, then covers the identity that goes with it.',
  businessValue: {
    summary:
      'A decision guide for connecting BI tools, apps, partner tools, and other databases to Databricks. IT sponsors reuse existing tools under one governance layer instead of building an integration per tool.',
    outcomes: [
      {
        title: 'Keep your BI tools',
        body: 'Power BI, Tableau, Excel, and custom apps connect to a SQL warehouse with a hostname, an HTTP path, and an OAuth identity. Reporting does not need to move.',
      },
      {
        title: 'Unattended access without personal logins',
        body: 'Scheduled reports and apps use a service principal with OAuth M2M, scoped to the tables they read. Long-lived secrets stay out of code.',
      },
      {
        title: 'One governance across tools',
        body: 'Grants, row filters, column masks, and audit logs from Unity Catalog apply whichever tool connects.',
      },
      {
        title: 'The right back end for apps',
        body: 'Lakebase, managed Postgres, serves apps that read and write single rows. Analytical engines stay free for analytics.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'BI tools and apps connect to a SQL warehouse with OAuth.',
      body: 'Power BI, Tableau, Excel, and custom apps take a hostname, an HTTP path, and an OAuth identity. Use a service principal with OAuth M2M for unattended connections.',
    },
    {
      title: 'Query in place, ingest, or share: pick by freshness and load.',
      body: 'Lakehouse Federation queries external systems where they are. Lakeflow Connect ingests them into Delta. OpenSharing and the Iceberg REST catalog expose Databricks data to other engines.',
    },
    {
      title: 'Use partner tools for what they already do.',
      body: 'Fivetran, dbt, and other partners connect through Partner Connect and standard drivers. Prefer managed connectors for the systems they cover.',
    },
    {
      title: 'Use Lakebase for transactional workloads.',
      body: 'Lakebase is managed Postgres for OLTP apps. Synced tables copy Unity Catalog data into it for low-latency reads.',
    },
    {
      title: 'Govern every path with Unity Catalog.',
      body: 'Grants, row filters, column masks, and audit logs apply no matter which tool connects.',
    },
  ],
  sections: [
    {
      id: 'patterns',
      heading: 'Choose an integration pattern',
      prose:
        'Start from what the other system needs to do. The matrix lists the pattern Databricks recommends for each need.',
      diagram: {
        type: 'matrix',
        title: 'Need to pattern',
        description:
          'To visualize governed data in BI tools or an app, use a SQL warehouse with OAuth. To use data that lives in another database without copying it, use Lakehouse Federation. To land data from SaaS apps or databases in Delta on a schedule, use Lakeflow Connect. To let another engine read Databricks tables, use OpenSharing or the Iceberg REST catalog. To serve a transactional app, use Lakebase and synced tables.',
        corner: 'Need ↓ · Pattern →',
        columns: ['Pattern', 'Data moves?', 'Best when'],
        rows: [
          {
            label: 'Analyze governed data',
            sub: 'BI tools, apps, Excel',
            cells: [
              { state: 'own', text: 'SQL warehouse + OAuth' },
              { state: 'own', text: 'No' },
              { state: 'own', text: 'Interactive, governed reads' },
            ],
          },
          {
            label: 'Use data in another database',
            cells: [
              { state: 'own', text: 'Lakehouse Federation' },
              { state: 'own', text: 'No, query in place' },
              {
                state: 'optional',
                text: 'Ad hoc, small, fresh',
                detail:
                  'Every query hits the source, so speed depends on the source and pushdown. Heavy or repeated use loads the source and calls for ingestion.',
              },
            ],
          },
          {
            label: 'Land source data',
            sub: 'SaaS apps and databases',
            cells: [
              { state: 'own', text: 'Lakeflow Connect' },
              {
                state: 'optional',
                text: 'Yes, incremental',
                detail:
                  'Managed connectors load incrementally into Delta tables. You pay for pipeline compute, and data is as fresh as the last sync.',
              },
              { state: 'own', text: 'Repeated or heavy use' },
            ],
          },
          {
            label: 'Let others read your data',
            cells: [
              { state: 'own', text: 'OpenSharing, Iceberg REST' },
              { state: 'own', text: 'No copy' },
              { state: 'own', text: 'Partners and other engines' },
            ],
          },
          {
            label: 'Serve a transactional app',
            cells: [
              { state: 'own', text: 'Lakebase + synced tables' },
              {
                state: 'optional',
                text: 'Synced copy',
                detail:
                  'Synced tables copy Unity Catalog data into Lakebase for low-latency reads, so the app reads a copy.',
              },
              { state: 'own', text: 'Low-latency OLTP reads' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Recommended' },
          { state: 'optional', label: 'Check the trade-off' },
        ],
      },
      links: [
        {
          label: 'Lakehouse Federation',
          url: 'https://docs.databricks.com/aws/en/query-federation/',
        },
        {
          label: 'Lakeflow Connect',
          url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/',
        },
        {
          label: 'OpenSharing',
          url: 'https://docs.databricks.com/aws/en/opensharing',
        },
      ],
    },
    {
      id: 'connector',
      heading: 'BI tools and apps: a SQL warehouse with OAuth',
      prose:
        'Every BI tool and custom application connects the same way: the hostname, the HTTP path of a SQL warehouse, and an OAuth identity. Use a serverless SQL warehouse so the tool does not wait for startup.',
      steps: [
        {
          title: 'Connect',
          body: 'Hostname and HTTP path identify the warehouse. A credentials provider supplies the OAuth header, so no token is stored in the app.',
          code: 'sql.connect(server_hostname=host,\n  http_path="/sql/1.0/warehouses/<id>",\n  credentials_provider=lambda: cfg.authenticate)',
        },
        {
          title: 'Parameterize',
          body: 'Use named parameters such as WHERE region = :region instead of building SQL strings. It prevents injection and lets the warehouse reuse plans.',
        },
        {
          title: 'Choose the identity',
          body: 'Interactive users sign in with OAuth user-to-machine. Scheduled reports and apps use a service principal with OAuth M2M, scoped to the tables they read.',
        },
      ],
      points: [
        {
          strong: 'Power BI and Tableau.',
          text: 'Both authenticate with OAuth. Power BI supports service principals for M2M and Microsoft Entra ID single sign-on. Tableau Cloud publishing requires OAuth. Create the Power BI connection in Unity Catalog first.',
        },
        {
          strong: 'Excel.',
          text: 'The Databricks Excel Add-in is generally available. It browses governed Unity Catalog tables and views, runs SQL, builds pivot tables, and writes data back, with the user’s own permissions.',
        },
        {
          strong: 'Size for the audience.',
          text: 'Dashboards that many people open need a warehouse sized and scaled for concurrency. Put metric views behind them, so every tool reports the same numbers.',
        },
      ],
      options: {
        caption: 'Which identity a BI tool or app uses',
        rows: [
          {
            option: 'OAuth user-to-machine (each user signs in)',
            when: 'People explore data interactively and should see only what their own grants allow.',
            tradeoffs:
              'Unity Catalog permissions, row filters, and column masks apply per person, and the audit log names the user. Each user needs access, and a shared dashboard can show different numbers to different people.',
          },
          {
            option: 'Service principal with OAuth machine-to-machine',
            when: 'Scheduled reports, embedded apps, and shared dashboards that every viewer sees the same way.',
            tradeoffs:
              'One scoped, rotatable identity with no human owner to leave. Everyone who reaches the report sees what the principal can see, so scope its grants to the report and enforce user-level access in the app. Audit shows the principal, not the viewer.',
          },
          {
            option: 'Personal access token',
            when: 'A tool that does not support OAuth yet.',
            tradeoffs:
              'Simple to set up, but a token is a long-lived secret that is easy to leak and tied to one person. Treat it as a fallback and move to OAuth when the tool allows.',
          },
        ],
        recommendation:
          'Use user-to-machine OAuth for interactive BI and machine-to-machine OAuth with a scoped service principal for scheduled reports and apps. Use a token only where the tool has no OAuth option.',
      },
      links: [
        {
          label: 'OAuth user-to-machine (U2M) authentication',
          url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-u2m',
        },
        {
          label: 'OAuth machine-to-machine (M2M) authentication',
          url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m',
        },
        {
          label: 'Connect Power BI',
          url: 'https://docs.databricks.com/aws/en/partners/bi/power-bi',
        },
        {
          label: 'Connect Tableau',
          url: 'https://docs.databricks.com/aws/en/partners/bi/tableau',
        },
        {
          label: 'Excel Add-in',
          url: 'https://docs.databricks.com/aws/en/integrations/excel',
        },
      ],
    },
    {
      id: 'federation',
      heading: 'Federation, ingestion, or sharing',
      prose:
        'Federation runs queries against an external database through a Unity Catalog connection, with no copy. That fits ad hoc analysis and data that must be current. It is not a substitute for ingestion: every query hits the source, so performance depends on the source and the pushdown, and heavy or repeated use loads the source system.',
      points: [
        {
          strong: 'Federate when the data is small, fresh, or rarely read.',
          text: 'A lookup table, a one-time analysis, or a proof of concept. Foreign catalogs make remote tables look like local ones, with Unity Catalog permissions on top.',
        },
        {
          strong: 'Ingest with Lakeflow Connect when many people read it.',
          text: 'Managed connectors load SaaS apps and databases incrementally into Delta tables, which are faster, cheaper per query, and available when the source is not.',
        },
        {
          strong: 'Share outward with OpenSharing or the Iceberg REST catalog.',
          text: 'OpenSharing (formerly Delta Sharing) gives recipients live, governed access without a copy. The Unity Catalog Iceberg REST catalog gives Iceberg engines the same, with credential vending.',
        },
        {
          strong: 'Keep credentials in connections.',
          text: 'A Unity Catalog connection holds the host and credentials. Use secrets or OAuth rather than literals, and grant CREATE CONNECTION and USE CONNECTION narrowly.',
        },
      ],
      options: {
        caption: 'Getting data from another system',
        rows: [
          {
            option: 'Lakehouse Federation',
            when: 'Ad hoc analysis, a lookup table, a proof of concept, or data that must be current at query time.',
            tradeoffs:
              'No copy and no pipeline to run, with Unity Catalog permissions on top. Every query hits the source, so speed depends on the source and the pushdown, and heavy or repeated reads load the source system. The data is unavailable when the source is down.',
          },
          {
            option: 'Lakeflow Connect managed ingestion',
            when: 'Many people read the data, or a SaaS app or database feeds recurring analytics.',
            tradeoffs:
              'Incremental loads into Delta tables, which read faster and cost less per query, and stay available when the source is not. You pay for pipeline compute and accept data that is as fresh as the last sync. Check the release stage of the specific connector.',
          },
          {
            option: 'A partner ELT tool',
            when: 'The source has no managed connector, or your team already runs the tool and its governance.',
            tradeoffs:
              'Broad source coverage and existing skills. It adds a vendor license and another system to secure, and the tool runs outside Unity Catalog governance until data lands. Each tool should use its own service principal.',
          },
        ],
        recommendation:
          'Federate small, fresh, or rarely read data. Ingest with a managed Lakeflow Connect connector when many people read it, and use a partner tool only where no managed connector covers the source.',
      },
      links: [
        { label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' },
        { label: 'Lakeflow Connect overview', url: 'https://docs.databricks.com/aws/en/ingestion/overview' },
      ],
      examples: [
        {
          label: 'Register a connection and a foreign catalog, with secrets',
          language: 'sql',
          code: "CREATE CONNECTION pg_conn TYPE postgresql\nOPTIONS (\n  host '<host>',\n  port '5432',\n  user secret('<scope>', 'pg_user'),\n  password secret('<scope>', 'pg_password')\n);\n\nCREATE FOREIGN CATALOG pg_sales USING CONNECTION pg_conn\nOPTIONS (database '<database>');",
          notes: [
            'Creating a catalog needs CREATE CATALOG on the metastore. Ask an admin to grant it, or have them create the foreign catalog.',
            'Check the Lakehouse Federation page for the connection types and authentication options of your source.',
          ],
        },
      ],
    },
    {
      id: 'lakebase',
      heading: 'Lakebase for transactional apps',
      prose:
        'An app that reads and writes single rows with low latency needs a transactional database, and analytical engines serve it poorly. Lakebase is managed Postgres on the platform for that workload. Synced tables copy Unity Catalog data into it for lookups. The App development with Lakebase guide covers connections, sync modes, and branches.',
      links: [
        {
          label: 'Lakebase Postgres',
          url: 'https://docs.databricks.com/aws/en/oltp/',
        },
      ],
    },
    {
      id: 'partners',
      heading: 'Partner tools',
      prose:
        'Partner tools connect through the same interfaces: the SQL warehouse for reads and transformations, and Unity Catalog volumes or tables for loads.',
      points: [
        {
          strong: 'dbt, Fivetran, and similar tools.',
          text: 'Connect with a SQL warehouse and a service principal. Give each tool its own principal with the least privilege it needs, so you can audit and revoke it alone.',
        },
        {
          strong: 'Prefer Partner Connect for setup.',
          text: 'It prefills the warehouse connection details for supported partners. Still give each tool its own principal and review its grants.',
        },
        {
          strong: 'Check for a managed alternative.',
          text: 'If Lakeflow Connect already covers a source, a managed connector costs less to run than a third-party pipeline.',
        },
      ],
      links: [
        {
          label: 'dbt with Databricks',
          url: 'https://docs.databricks.com/aws/en/partners/prep/dbt',
        },
      ],
    },
    {
      id: 'identity',
      heading: 'Identity and connectivity',
      prose: 'Match the identity to the pattern, and keep long-lived secrets out of code and bundles.',
      table: {
        columns: ['Pattern', 'Identity and path'],
        rows: [
          ['Interactive BI user', 'OAuth user-to-machine; the user’s own Unity Catalog permissions apply'],
          ['Scheduled report or app', 'Service principal with OAuth M2M over HTTPS to /sql/1.0/warehouses/<id>'],
          [
            'Federation',
            'Credentials in a Unity Catalog connection, from a secret or OAuth; grant USE CONNECTION narrowly',
          ],
          ['Outside Iceberg engine', 'Service principal with OAuth M2M and credential vending'],
          [
            'Private networks',
            'Use private connectivity and IP access lists for the workspace; check that the tool can reach the warehouse',
          ],
        ],
      },
    },
  ],
  related: [
    { slug: 'iceberg-support', title: 'Apache Iceberg interoperability' },
    { slug: 'relational-db-ingestion', title: 'Relational database extracts' },
    { slug: 'local-tool-connectivity', title: 'Local tool connectivity' },
    { slug: 'lakebase-apps', title: 'App development with Lakebase' },
  ],
};
