import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'data-sharing',
  area: 'Governance/Monitoring',
  title: 'Governed data sharing',
  intro:
    'OpenSharing (renamed from Delta Sharing in June 2026) lets you share live data and AI assets from Unity Catalog without copying them. The provider creates a share and a recipient, grants one to the other, and revokes when the relationship ends. This page covers which recipient type to pick, the privileges involved, how to share a subset safely, which assets you can share, how to harden credentials for recipients outside Databricks, what crossing a region or cloud costs, and how to audit it. It also covers sharing table history, how recipients stream and read changes, and when to federate or copy instead of share. It names the cases where Clean Rooms or Marketplace fit better.',
  businessValue: {
    summary:
      'Data owners can give partners, customers, and other business units live access to governed data without copying it. This guide is for CDOs and data platform leads who must share outside the company and still control and audit it.',
    outcomes: [
      {
        title: 'No copies to reconcile',
        body: 'OpenSharing shares live Unity Catalog data, so recipients read current data. There are no extracts to send, no stale copies, and no second set of files to secure.',
      },
      {
        title: 'Share only what is approved',
        body: 'A view fixes the rows and columns a recipient sees, and the share holds the view, not the base table. Revoking the share ends access.',
      },
      {
        title: 'Controlled access for outside recipients',
        body: 'Databricks-to-Databricks sharing needs no token. For open recipients, OIDC federation, short token lifetimes, and IP access lists limit the risk of a leaked credential.',
      },
      {
        title: 'A record of who received what',
        body: 'Sharing activity appears in system tables, so security can review it. Cross-region and cross-cloud transfer is billed by the cloud provider, which finance should plan for.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Prefer Databricks-to-Databricks when the recipient has Unity Catalog.',
      body: 'There is no token to manage, and the recipient adds its own governance. Use an open recipient only for people on other platforms.',
    },
    {
      title: 'Share a view to share a subset.',
      body: 'Tables with row filters or column masks are not shared. A view that fixes the rows and columns carries the restriction, and you add the view, not the base table.',
    },
    {
      title: 'Harden every open recipient.',
      body: 'Prefer OIDC federation. If you must use a bearer token, set a short lifetime, add an IP access list, and rotate.',
    },
    {
      title: 'Know what shares and what does not.',
      body: 'Tables, views, schemas, volumes, materialized views, streaming tables, and metric views are shareable, with the limits listed below.',
    },
    {
      title: 'Share history when recipients need time travel, streaming, or faster reads.',
      body: 'WITH HISTORY is the default on Databricks Runtime 16.2 and above. Share WITHOUT HISTORY when past versions must stay private, and for partitioned tables, which do not get the speed-up.',
    },
    {
      title: 'Share, federate, or copy.',
      body: 'Share to give others live access to your Unity Catalog data. Federate to query data that lives in another system without moving it. Copy only when the target needs its own writable or isolated data.',
    },
    {
      title: 'Stream or read changes from a share only with history.',
      body: 'Streaming and change data feed need shared history and, for the feed, CDF on the table. Use batch reads when a daily snapshot is enough.',
    },
    {
      title: 'Cross-region and cross-cloud sharing costs egress.',
      body: 'Sharing in the same region is free of egress charges. Across regions or clouds the cloud provider bills transfer, so plan for it.',
    },
  ],
  sections: [
    {
      id: 'overview',
      heading: 'How a share reaches recipients',
      prose:
        'The provider puts tables, views, and other assets in a share and grants the share to recipients. Whether history goes with a table changes what recipients can do and how they read the files. Federation is a different path. It brings other systems into your catalogs and does not send your data out.',
      diagram: {
        type: 'flow',
        title: 'Provider, share, recipients, and federation',
        description:
          'The provider owns Unity Catalog tables and adds them to a share, with or without history. A Databricks-to-Databricks recipient mounts the share as a catalog. An open recipient reads through a client with a credential. Separately, Lakehouse Federation connects external databases and catalogs to Unity Catalog as foreign catalogs that the provider queries in place.',
        nodes: [
          {
            id: 'tables',
            label: 'Provider tables',
            sub: 'Unity Catalog',
            col: 0,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail:
              'Governed Delta tables, views, volumes, and other assets in the provider metastore. They stay in place; nothing is copied.',
          },
          {
            id: 'share',
            label: 'Share',
            sub: 'assets for recipients',
            col: 1,
            row: 1,
            kind: 'highlight',
            icon: 'data-shares',
            domain: 'governance',
            detail:
              'The set of assets you expose. A recipient reads a share only after you grant SELECT on it, and REVOKE ends new reads.',
          },
          {
            id: 'nohist',
            label: 'Without history',
            sub: 'current data only',
            col: 2,
            row: 0,
            icon: 'data-file',
            domain: 'data',
            detail:
              'Recipients read the current version. Past versions stay private. Default only on runtimes before 16.2.',
          },
          {
            id: 'hist',
            label: 'With history',
            sub: 'time travel, streaming',
            col: 2,
            row: 2,
            icon: 'event-stream',
            domain: 'data',
            detail:
              'Recipients can time travel, stream, and query the change data feed when CDF is on. Databricks-to-Databricks reads use cloud tokens scoped to the table root.',
          },
          {
            id: 'd2d',
            label: 'Databricks recipient',
            sub: 'no token',
            col: 3,
            row: 0,
            kind: 'surface',
            icon: 'delta-sharing-mark',
            domain: 'apps',
            detail:
              'Has a Unity Catalog workspace. It mounts the share as a catalog and adds its own grants, row filters, and masks.',
          },
          {
            id: 'open',
            label: 'Open recipient',
            sub: 'client and credential',
            col: 3,
            row: 2,
            kind: 'surface',
            icon: 'users',
            domain: 'apps',
            detail:
              'Reads through pandas, Spark, Power BI, Tableau, or an Iceberg client, with OIDC federation or a bearer token.',
          },
          {
            id: 'fed',
            label: 'Federation',
            sub: 'foreign catalogs',
            col: 1,
            row: 3,
            icon: 'network',
            domain: 'governance',
            detail:
              'Lakehouse Federation exposes external databases and catalogs in Unity Catalog. It is a separate path from sharing and it reads into Databricks.',
          },
          {
            id: 'ext',
            label: 'External systems',
            sub: 'databases, Hive, Glue',
            col: 0,
            row: 3,
            kind: 'store',
            icon: 'cloud-database',
            domain: 'data',
            detail:
              'Systems such as PostgreSQL, SQL Server, Snowflake, a Hive metastore, or AWS Glue, queried where they are.',
          },
        ],
        edges: [
          { from: 'tables', to: 'share', label: 'add' },
          { from: 'share', to: 'nohist', label: 'WITHOUT HISTORY' },
          { from: 'share', to: 'hist', label: 'WITH HISTORY' },
          { from: 'nohist', to: 'd2d' },
          { from: 'hist', to: 'd2d' },
          { from: 'nohist', to: 'open' },
          { from: 'hist', to: 'open' },
          { from: 'ext', to: 'fed', label: 'queried in place', dashed: true },
          { from: 'fed', to: 'tables', label: 'foreign catalog', dashed: true },
        ],
        legend: [
          { kind: 'surface', label: 'Recipients' },
          { kind: 'highlight', label: 'What you control' },
          { kind: 'store', label: 'Data' },
          { kind: 'dashed', label: 'Federation path' },
        ],
      },
      links: [{ label: 'What is OpenSharing?', url: 'https://docs.databricks.com/aws/en/delta-sharing/' }],
    },
    {
      id: 'recipients',
      heading: 'Pick the recipient type',
      prose:
        'The recipient type decides how the consumer authenticates and what they can do with the data. The provider chooses it when creating the recipient.',
      diagram: {
        type: 'matrix',
        title: 'Databricks-to-Databricks and open recipients',
        description:
          'A Databricks-to-Databricks recipient has a Unity Catalog workspace, is identified by a sharing identifier, uses no token, and mounts the share as a catalog it governs itself. An open recipient is on any platform, authenticates with OIDC federation or a bearer token, and reads through an OpenSharing client or connector with a credential from the provider.',
        corner: 'Aspect ↓ · Recipient →',
        columns: ['Databricks-to-Databricks', 'Open (Databricks-to-Open)'],
        rows: [
          {
            label: 'Who it is for',
            cells: [
              { state: 'own', text: 'Has a Unity Catalog workspace' },
              { state: 'optional', text: 'Any platform or client' },
            ],
          },
          {
            label: 'Authentication',
            cells: [
              {
                state: 'own',
                text: 'Sharing identifier, no token',
                detail: 'The provider identifies the recipient by its sharing identifier, so no token is issued.',
              },
              {
                state: 'optional',
                text: 'OIDC federation or bearer token',
                detail:
                  'The recipient reads through an OpenSharing client or connector with a credential from the provider.',
              },
            ],
          },
          {
            label: 'Recipient governance',
            cells: [
              {
                state: 'own',
                text: 'Grants, lineage, and its own row filters and masks',
                detail:
                  'The recipient mounts the share as a catalog in its own Unity Catalog metastore, so it governs the data itself.',
              },
              { state: 'none', text: 'Whatever the client provides' },
            ],
          },
          {
            label: 'Assets',
            cells: [
              { state: 'own', text: 'Widest set of asset types and features' },
              { state: 'optional', text: 'Tables, views, and the types the open protocol supports' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Preferred when available' },
          { state: 'optional', label: 'Use when needed' },
          { state: 'none', label: 'Not provided' },
        ],
      },
      options: {
        caption: 'Which recipient type to create',
        rows: [
          {
            option: 'Databricks-to-Databricks',
            when: 'The consumer has a Unity Catalog workspace.',
            tradeoffs:
              'No token to issue or rotate, and the recipient governs the data with its own grants, row filters, and masks. History sharing adds cloud-token reads for faster access. The recipient needs a Unity Catalog metastore, and you cannot reach people on other platforms.',
          },
          {
            option: 'Open recipient',
            when: 'The consumer is on another platform or tool: pandas, Spark, Power BI, Tableau, or an Iceberg client.',
            tradeoffs:
              'Reaches any client. You manage a credential, so you add lifetime limits and an IP access list, and you cannot control what the client does with the rows. Streaming tables and materialized views give open recipients the current snapshot only.',
          },
        ],
        recommendation:
          'Default to Databricks-to-Databricks whenever the consumer has Unity Catalog. Use an open recipient for everyone else.',
      },
      links: [
        { label: 'What is OpenSharing?', url: 'https://docs.databricks.com/aws/en/delta-sharing/' },
        {
          label: 'Databricks-to-Databricks protocol',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/share-data-databricks',
        },
        {
          label: 'Databricks-to-Open protocol',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/share-data-open',
        },
      ],
    },
    {
      id: 'privileges',
      heading: 'Privileges to set up and grant a share',
      prose: 'Give these to a group, not to a person, and make a group the share owner.',
      table: {
        columns: ['Task', 'Needs'],
        rows: [
          ['Create a share', 'CREATE SHARE on the metastore, in a workspace attached to that metastore'],
          [
            'Add a table, view, or other asset',
            'Share owner, USE CATALOG and USE SCHEMA on its parents, and SELECT on the asset. Keep the SELECT, or the asset stops being shared.',
          ],
          ['Create a recipient', 'Metastore admin or CREATE RECIPIENT on the metastore'],
          [
            'Grant a recipient access to a share',
            'Metastore admin, or (USE SHARE and SET SHARE PERMISSION, or share owner) and (USE RECIPIENT, or recipient owner)',
          ],
          ['Assign an IP access list to an existing recipient', 'Recipient owner'],
          ['Read audit events', 'SELECT on system.access.audit'],
        ],
      },
      points: [
        {
          strong: 'Ownership matters.',
          text: 'The share owner needs enough access to every asset in the share, including tables added to a shared schema later. Object creators have to grant it.',
        },
        {
          strong: 'Revoke to end access.',
          text: 'REVOKE on the share cuts the recipient off for new reads. For an open recipient, also rotate or drop the recipient to retire the credential.',
        },
      ],
    },
    {
      id: 'subsets',
      heading: 'Share a subset with a view',
      prose:
        'OpenSharing does not share a table that has row filters or column masks on it; the provider skips it. To give a recipient only some rows or columns, create a view over the table that selects them, and add the view to the share instead of the base table. The recipient never sees the base table or the columns you left out.',
      examples: [
        {
          label: 'A view that fixes the region and drops a PII column',
          language: 'sql',
          code: `CREATE OR REPLACE VIEW sales.shared.orders_west AS
SELECT order_id, order_date, region, product_id, amount
FROM sales.core.orders
WHERE region = 'WEST';

CREATE SHARE IF NOT EXISTS partner_orders;
ALTER SHARE partner_orders ADD VIEW sales.shared.orders_west AS shared.orders;
GRANT SELECT ON SHARE partner_orders TO RECIPIENT partner_acme;`,
          notes: [
            'Use AS to give the recipient a neutral schema and table name.',
            'A recipient on Databricks can apply its own row filters and column masks to shared tables in its metastore.',
          ],
        },
      ],
      points: [
        {
          strong: 'ABAC-secured tables.',
          text: 'Sharing a table or schema secured by ABAC policies is in preview. Only the share owner, or a user excluded from the policies, can add it, and the policy does not govern what the recipient reads. Share a view when the recipient should see less.',
        },
      ],
    },
    {
      id: 'assets',
      heading: 'What you can share',
      table: {
        caption: 'Shareable assets and their status in the current documentation',
        columns: ['Asset', 'Status and limits'],
        rows: [
          ['Delta tables', 'GA. Tables with row filters, column masks, collations, or SHALLOW CLONE are skipped.'],
          ['Views, including dynamic views', 'GA. Defined with a supported subset of functions.'],
          [
            'Schemas',
            'GA. New tables in the schema become visible automatically; aliases and partitions are not available.',
          ],
          ['Volumes', 'GA.'],
          [
            'Materialized views and streaming tables',
            'GA. The object itself cannot have row filters; open recipients read the current snapshot only.',
          ],
          [
            'Metric views',
            'GA (September 2026). Query with MEASURE() on serverless compute. A metric view over tables with row filters, masks, or ABAC policies cannot be shared.',
          ],
          [
            'Notebooks, AI models, Python UDFs, and other types',
            'Listed as shareable in the documentation. Check the page for each type before you commit to it.',
          ],
        ],
      },
      links: [
        { label: 'Create shares', url: 'https://docs.databricks.com/aws/en/delta-sharing/create-share' },
        {
          label: 'Access shared data as a recipient',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/recipient',
        },
      ],
    },
    {
      id: 'history',
      heading: 'Share table history',
      prose:
        'A shared table can carry its Delta history with it. The history decides whether recipients can time travel, stream, or read the change feed, and for Databricks-to-Databricks recipients it changes how they read the files.',
      steps: [
        {
          title: 'Add the table WITH HISTORY',
          body: 'Use ALTER SHARE with the WITH HISTORY clause, or select the History option in Catalog Explorer when you add the table. It needs Databricks Runtime 12.2 LTS or above.',
          code: `ALTER SHARE partner_orders
ADD TABLE sales.core.orders WITH HISTORY;`,
        },
        {
          title: 'Know the default',
          body: 'The docs say WITH HISTORY is the default when you share a table from Databricks Runtime 16.2 or above, and always the default for schemas. Earlier runtimes default to WITHOUT HISTORY.',
        },
        {
          title: 'Change it on a table already in the share',
          body: 'The docs show ALTER SHARE with ADD TABLE and WITH HISTORY to enable history on a table already in the share, and they describe turning it off the same way. If you set an alias or partitions, repeat them in the statement. Check the result in the history_sharing column of SHOW ALL IN SHARE, or the history_data_sharing_status field in the API.',
          code: `ALTER SHARE partner_orders
ADD TABLE sales.core.orders WITH HISTORY;
SHOW ALL IN SHARE partner_orders;`,
        },
      ],
      points: [
        {
          strong: 'What recipients get.',
          text: 'Time travel queries, streaming reads with Spark Structured Streaming, transactions, and change data feed queries with table_changes() when CDF is already enabled on the table.',
        },
        {
          strong: 'Why reads are faster.',
          text: 'The docs say sharing history improves performance by using temporary security credentials from your cloud storage, scoped down to the root directory of the provider table, with performance comparable to direct access to the source table. This applies to Databricks-to-Databricks shares.',
        },
        {
          strong: 'Limits.',
          text: 'Partitioned tables do not get the speed-up. A share that crosses into or out of AWS GovCloud or GovCloud DoD uses pre-signed URLs instead of cloud tokens. For streaming tables, WITH HISTORY has no effect and recipients read through serverless compute.',
        },
        {
          strong: 'Release stage.',
          text: 'History sharing for faster Databricks-to-Databricks reads entered Public Preview in December 2024. The June 2025 release notes list it as GA and enabled by default.',
        },
        {
          strong: 'Cost and exposure.',
          text: 'Past versions become readable to the recipient, including rows later updated or deleted. Share WITHOUT HISTORY when old data must stay private, such as corrected personal data. The history files also stay in your storage until you vacuum them, which is a storage cost you pay (practical guidance, not stated in the docs).',
        },
      ],
      options: {
        caption: 'With or without history',
        rows: [
          {
            option: 'WITH HISTORY',
            when: 'Recipients need time travel, streaming, or the change feed, or they are Databricks recipients reading large unpartitioned tables.',
            tradeoffs:
              'Faster Databricks-to-Databricks reads through cloud tokens, plus time travel, streaming, and CDF. The recipient sees past versions, and you keep the history files in storage.',
          },
          {
            option: 'WITHOUT HISTORY',
            when: 'Past versions are sensitive, or recipients only need the current snapshot.',
            tradeoffs:
              'Past data stays private and storage is smaller. Recipients lose time travel, streaming, and the change feed, and Databricks-to-Databricks reads lose the cloud-token speed-up.',
          },
        ],
        recommendation:
          'Keep WITH HISTORY, which is the default on current runtimes, unless past versions must stay hidden. Check partitioned tables separately, because they get no performance benefit.',
      },
      links: [
        {
          label: 'Share history (create a share)',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/create-share',
        },
        {
          label: 'History sharing performance (Databricks-to-Databricks)',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/share-data-databricks',
        },
      ],
    },
    {
      id: 'reads',
      heading: 'How recipients read a share',
      prose:
        'A Databricks recipient queries the shared catalog like any Unity Catalog table. An open recipient picks a client. What works depends on the history you shared and on the table features.',
      table: {
        caption: 'Open clients the documentation lists',
        columns: ['Client', 'How it reads and what to watch'],
        rows: [
          [
            'pandas',
            'delta_sharing.load_as_pandas(). Version 1.1.0 or later reads tables with column mapping as a snapshot; CDF on those tables is not supported.',
          ],
          [
            'Apache Spark',
            'delta_sharing.load_as_spark(). Streaming and CDF on tables with deletion vectors or column mapping need Databricks Runtime 14.2 or above, delta-sharing-spark 3.1 or later, and responseFormat=delta.',
          ],
          [
            'Power BI',
            'The OpenSharing connector in Get Data, with the endpoint URL and token. The data must fit in the memory of the machine.',
          ],
          [
            'Tableau',
            'The connector from Tableau Exchange, with the credential file. Tableau is deprecating that connector, so check it before you rely on it. Deletion vectors and column mapping are not supported, and the data must fit in memory.',
          ],
          [
            'Iceberg clients',
            'Snowflake, Trino, Flink, and Spark connect through a REST catalog with the endpoint, bearer token, and share name. Listing is limited to the first 100 shared views in a namespace.',
          ],
        ],
      },
      points: [
        {
          strong: 'Streaming.',
          text: 'Databricks recipients can run Structured Streaming on a shared table when history is shared and they use Databricks Runtime 12.2 LTS or above. The docs list ignoreDeletes, ignoreChanges, startingVersion, startingTimestamp, maxFilesPerTrigger, maxBytesPerTrigger, and readChangeFeed.',
        },
        {
          strong: 'Change data feed.',
          text: 'If CDF is enabled on the table, recipients can query it by version or timestamp. Set responseFormat=delta for streaming CDF.',
        },
        {
          strong: 'Snapshots only.',
          text: 'Streaming tables and materialized views give open recipients the current snapshot. Streaming reads are not supported on materialized views for open recipients.',
        },
        {
          strong: 'Transactions.',
          text: 'A recipient can run a transaction on a shared table only if the provider shared it WITH HISTORY. The Transactions page requires Databricks Runtime 18.1 or above for shared assets and does not support time travel inside a transaction.',
        },
      ],
      examples: [
        {
          label: 'Time travel, change feed, and streaming from a shared catalog',
          language: 'sql',
          code: `-- Needs history shared with the table
SELECT * FROM partner_catalog.shared.orders VERSION AS OF 3;

-- Needs CDF enabled on the table
SELECT * FROM table_changes('partner_catalog.shared.orders', 3, 5);`,
          notes: [
            'In Python, spark.readStream.format("deltaSharing").table("partner_catalog.shared.orders") streams the shared table.',
          ],
        },
      ],
      options: {
        caption: 'Streaming, change feed, or batch reads',
        rows: [
          {
            option: 'Batch snapshot',
            when: 'The recipient needs current data on a schedule, or reads from an open client such as Power BI or pandas.',
            tradeoffs:
              'Works without history and with every client. Each read scans the table again, so freshness is the schedule and cost grows with table size.',
          },
          {
            option: 'Change data feed',
            when: 'The recipient only needs inserts, updates, and deletes since its last read.',
            tradeoffs:
              'Reads far less data on large tables. It needs history and CDF on the table, the provider stores the change records, and some table features need Runtime 14.2 or above.',
          },
          {
            option: 'Streaming read',
            when: 'The recipient needs near-real-time updates in a Spark pipeline.',
            tradeoffs:
              'Lowest latency and incremental processing. It needs shared history, a running recipient stream, and a restart plan when the provider deletes or updates rows.',
          },
        ],
        recommendation:
          'Start with batch snapshots. Move to the change feed when snapshots get large, and to streaming only when the recipient needs low latency.',
      },
      links: [
        {
          label: 'Read shared data (Databricks)',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/read-data-databricks',
        },
        {
          label: 'Read shared data (open clients)',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/read-data-open',
        },
      ],
    },
    {
      id: 'hardening',
      heading: 'Harden open recipients',
      prose:
        'An open recipient holds a credential that works from anywhere until it expires. Reduce what that credential can do.',
      steps: [
        {
          title: 'Prefer OIDC federation',
          body: "The recipient's identity provider issues short-lived JWTs, enforces MFA, and controls their lifetime. Databricks validates the token against a federation policy you create and never issues a long-lived secret. Email-based activation is not available in this flow.",
        },
        {
          title: 'If you use bearer tokens, set a short lifetime',
          body: 'The token lifetime defaults to the metastore setting; lower it there or per recipient. Tokens issued before December 8, 2025 with no expiry, or an expiry after December 8, 2026, expire on December 8, 2026. Renew them on a schedule you control.',
        },
        {
          title: 'Add an IP access list',
          body: 'Allow lists only, up to 100 IPv4 addresses or CIDR ranges per recipient, independent of workspace IP access lists. It covers the REST API, the activation URL, and credential download. Without SecureConnect, storage URLs are reachable from any IP.',
        },
        {
          title: 'Send credentials over a secure channel',
          body: 'The activation link downloads the credential file once. Treat the file as a secret, and drop or rotate the recipient when the engagement ends.',
        },
      ],
      options: {
        caption: 'How an open recipient authenticates',
        rows: [
          {
            option: 'OIDC federation',
            when: "The recipient's identity provider can issue JWTs and their client supports federation.",
            tradeoffs:
              'Tokens are short-lived and the identity provider enforces MFA and sets lifetimes. Databricks never issues a long-lived secret. The recipient needs an identity provider you can write a federation policy for, and email activation is not available.',
          },
          {
            option: 'Bearer token',
            when: 'The recipient has no OIDC provider, or the client only accepts a credential file.',
            tradeoffs:
              'Works with the widest set of clients and is simple to start. The credential is a secret that works from anywhere until it expires, so you set a short lifetime, renew it on a schedule, add an IP access list, and send it over a secure channel.',
          },
        ],
        recommendation:
          'Use OIDC federation whenever the recipient can support it. Use a bearer token only when it cannot, and pair it with a short lifetime and an IP access list.',
      },
      links: [
        {
          label: 'OIDC federation for recipients',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/create-recipient-oidc-fed',
        },
        {
          label: 'Bearer-token recipients and lifetime',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/create-recipient-token',
        },
        {
          label: 'IP access lists for recipients',
          url: 'https://docs.databricks.com/aws/en/delta-sharing/access-list',
        },
        { label: 'Create a recipient', url: 'https://docs.databricks.com/aws/en/delta-sharing/create-recipient' },
      ],
    },
    {
      id: 'alternatives',
      heading: 'When Clean Rooms or Marketplace fit better',
      options: {
        caption: 'Which sharing mechanism fits the need',
        rows: [
          {
            option: 'A share and a recipient',
            when: 'Give a known recipient read access to live data.',
            tradeoffs:
              'No copy to keep in sync, and you audit access through system tables. The recipient reads the rows you expose, so share a view when it should see a subset. Cross-region and cross-cloud reads can incur egress charges.',
          },
          {
            option: 'Clean Rooms',
            when: "Two or more parties compute on combined sensitive data without seeing each other's raw rows.",
            tradeoffs:
              'Strongest isolation, because only approved code runs, on serverless compute over OpenSharing. It takes more setup and approval than a plain share, and collaborators work inside what the clean room allows.',
          },
          {
            option: 'Marketplace',
            when: 'Publish a dataset or AI asset to many consumers, free or paid, with listings and terms.',
            tradeoffs:
              'Reach and a standard listing and terms process. You give up the one-to-one control of a named recipient, and a listing takes effort to prepare and maintain.',
          },
          {
            option: 'Replicate to their storage or account',
            when: 'The recipient needs its own writable copy or must be isolated from your storage.',
            tradeoffs:
              'The recipient is independent of your platform. You pay for storage, a copy pipeline, and egress, the copy lags the source, and you lose governance over the data once it leaves.',
          },
        ],
        recommendation:
          "Start with a share to a named recipient. Move to Clean Rooms when neither side may see the other's raw rows, to Marketplace when the audience is open, and replicate only when the recipient needs a writable or isolated copy.",
      },
      links: [
        { label: 'Clean Rooms', url: 'https://docs.databricks.com/aws/en/clean-rooms/' },
        { label: 'Marketplace', url: 'https://docs.databricks.com/aws/en/marketplace/' },
        { label: 'Create and manage shares', url: 'https://docs.databricks.com/aws/en/delta-sharing/create-share' },
        {
          label: 'Publish data in Marketplace',
          url: 'https://docs.databricks.com/aws/en/marketplace/get-started-provider',
        },
      ],
    },
    {
      id: 'federation',
      heading: 'Share, federate, or copy',
      prose:
        'Sharing sends your Unity Catalog data to others. Federation does the reverse. It lets you query data that lives in another system without moving it. The two answer different questions, so pick by the direction the data needs to travel.',
      table: {
        caption: 'The two kinds of Lakehouse Federation',
        columns: ['Kind', 'What it does'],
        rows: [
          [
            'Query federation',
            'Pushes Unity Catalog queries to the foreign database over JDBC, so the query runs on Databricks and the remote system. Documented sources include MySQL, PostgreSQL, Teradata, Oracle, Amazon Redshift, Salesforce Data 360, Snowflake, SQL Server, Azure Synapse, BigQuery, and Databricks. The docs suggest it for ad hoc reporting, BI, and proof-of-concept access to operational databases.',
          ],
          [
            'Catalog federation',
            'Reads files directly in object storage on Databricks compute only, which the docs call more cost-effective and performance-optimized than query federation. Documented sources include the Databricks legacy Hive metastore, external Hive metastores, AWS Glue, Snowflake, Salesforce Data 360, Palantir Foundry, and Workday Data Connect.',
          ],
        ],
      },
      points: [
        {
          strong: 'Hive metastore and Glue.',
          text: 'Federation creates a foreign catalog that mirrors the metastore tables under Unity Catalog governance. Iceberg tables in federated external Hive metastores and Glue, and shallow clones, are in Public Preview. Sharing foreign tables is separate. Foreign Iceberg tables can be shared (generally available September 11, 2026), and foreign Delta tables were in Public Preview as of August 27, 2026.',
        },
        {
          strong: 'Consuming data from other platforms.',
          text: 'To read data another provider shares over the open protocol, import the provider in Catalog Explorer. The shared tables then behave like any Unity Catalog table, with no credential file path in your code. That is a recipient-side path, not federation.',
        },
        {
          strong: 'High volume or low latency.',
          text: 'When the source supports both Lakehouse Federation and Lakeflow Connect, Databricks recommends Lakeflow Connect if performance on higher data volumes and lower latency are priorities.',
        },
      ],
      options: {
        caption: 'Share, federate, or copy',
        rows: [
          {
            option: 'Share',
            when: 'Others need live read access to data you govern in Unity Catalog.',
            tradeoffs:
              'Fresh data with no copy, and audit through system tables. The recipient reads your storage, so cross-region reads can cost egress, and the recipient controls its own queries.',
          },
          {
            option: 'Federate',
            when: 'You need to query data that lives in another database or catalog, without moving it, for reports or a proof of concept.',
            tradeoffs:
              'Fresh data and no pipeline. Query federation sends work to the source system, so it adds load there and is slower on large scans. Catalog federation reads files on Databricks compute and costs less. Unity Catalog governs access, but the source system keeps its own data.',
          },
          {
            option: 'Copy (ingest)',
            when: 'You need high volume, low latency, a writable copy, or independence from the source or the recipient.',
            tradeoffs:
              'Best performance, because the data is local Delta. You pay for storage and a pipeline, the copy lags the source, and a copy shared outward is a second dataset to govern.',
          },
        ],
        recommendation:
          'Default to sharing for outbound access to Unity Catalog data and federation for inbound access to external systems. Copy only when volume, latency, or isolation demands it.',
      },
      links: [
        { label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' },
        {
          label: 'Hive metastore and Glue federation',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/hms-federation/',
        },
        { label: 'Read open-shared data', url: 'https://docs.databricks.com/aws/en/delta-sharing/read-data-open' },
      ],
    },
    {
      id: 'egress',
      heading: 'Cross-region and cross-cloud egress',
      prose:
        'A share points at your data in place. The recipient reads it through pre-signed URLs or scoped credentials, so nothing is copied, and sharing within a region has no egress charge.',
      points: [
        {
          strong: 'Across regions or clouds.',
          text: 'Your cloud provider can bill data transfer when the recipient reads from another region or cloud. Large, frequently read tables multiply it.',
        },
        {
          strong: 'Ways to contain it.',
          text: "Share from Cloudflare R2, which has no egress fees. Replicate a table into the recipient's region once, and share the replica. Or have recipients read the data once and cache it.",
        },
        {
          strong: 'SecureConnect.',
          text: 'If the provider uses SecureConnect, Databricks bills the data transfer instead of the cloud vendor, and the recipient IP access list also applies to storage.',
        },
        {
          strong: 'Views, materialized views, and streaming tables.',
          text: 'Databricks materializes these for sharing. Events appear in system.sharing.materialization_history.',
        },
      ],
    },
    {
      id: 'audit',
      heading: 'Audit sharing with system tables',
      prose:
        'Provider audit logs record what you do and what recipients do with your shares. They live in system.access.audit once an account admin enables the audit system table.',
      examples: [
        {
          label: 'Recent sharing activity for one share',
          language: 'sql',
          code: `SELECT event_time, action_name, user_identity.email AS actor,
       request_params, response.status_code
FROM system.access.audit
WHERE event_date >= current_date() - INTERVAL 7 DAYS
  AND service_name = 'unityCatalog'
  AND (action_name LIKE 'deltaSharing%' OR action_name IN ('createShare', 'updateShare', 'createRecipient'))
ORDER BY event_time DESC;`,
          notes: [
            'deltaSharingQueriedTable and deltaSharingQueriedTableChanges record recipient reads of tables shared by pre-signed URL.',
            'Event names and request_params vary by asset type; check the OpenSharing events list and filter on the share or recipient in request_params. Audit rows arrive after the event.',
          ],
        },
      ],
      links: [
        { label: 'Audit and monitor data sharing', url: 'https://docs.databricks.com/aws/en/delta-sharing/audit-logs' },
      ],
    },
  ],
  related: [
    { slug: 'access-management', title: 'Access management' },
    { slug: 'row-column-security', title: 'Row and column security' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
  ],
};
