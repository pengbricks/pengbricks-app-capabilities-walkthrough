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
              { state: 'optional', text: 'Ad hoc, small, fresh' },
            ],
          },
          {
            label: 'Land source data',
            sub: 'SaaS apps and databases',
            cells: [
              { state: 'own', text: 'Lakeflow Connect' },
              { state: 'optional', text: 'Yes, incremental' },
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
              { state: 'optional', text: 'Synced copy' },
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
      links: [
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
        'Analytical engines are the wrong back end for an app that reads and writes single rows with low latency. Lakebase is managed Postgres on the platform, with Unity Catalog integration, for that workload.',
      points: [
        {
          strong: 'Use Lakebase as the operational database.',
          text: 'Connect Databricks Apps or any Postgres client for OLTP. It scales automatically and branches instantly for development.',
        },
        {
          strong: 'Serve lakehouse data with synced tables.',
          text: 'Sync Unity Catalog tables into Lakebase so an app can read curated data at low latency without querying the warehouse on each request.',
        },
        {
          strong: 'Bring Postgres changes back.',
          text: 'Store Postgres changes as Delta tables for downstream pipelines and audit.',
        },
      ],
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
          ['Federation', 'Credentials in a Unity Catalog connection, from a secret or OAuth; grant USE CONNECTION narrowly'],
          ['Outside Iceberg engine', 'Service principal with OAuth M2M and credential vending'],
          ['Private networks', 'Use private connectivity and IP access lists for the workspace; check that the tool can reach the warehouse'],
        ],
      },
    },
  ],
  related: [
    { slug: 'iceberg-support', title: 'Apache Iceberg interoperability' },
    { slug: 'relational-db-ingestion', title: 'Relational database extracts' },
    { slug: 'local-tool-connectivity', title: 'Local tool connectivity' },
  ],
};
