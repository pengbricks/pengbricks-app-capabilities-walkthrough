import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'migrate-off-databricks',
  area: 'General Guides',
  title: 'Migrating off Databricks',
  intro:
    'Most of what you build on Databricks is stored or written in open formats and open-source APIs, so an exit is mostly a planning and sequencing job. Table data sits in your cloud storage as Delta Lake or Apache Iceberg. Spark, SQL, and Python code runs elsewhere with edits. The parts that do not travel are the ones built on the platform itself: governance policies and lineage history, serving endpoints, AI/BI dashboards, Genie Agents, and Databricks Apps. This page covers how outside engines read your data, whether to move it or read it in place, what metadata and code carry over, what it costs, and how to phase the exit. It uses public Databricks documentation and the open-source project docs, and it takes no side on whether you should leave.',
  businessValue: {
    summary:
      'Leadership, procurement, and architecture teams ask what an exit would take before they commit to a platform. A tested answer, built from an inventory of your own tables and workloads, replaces a guess and keeps the choice to stay a choice.',
    outcomes: [
      {
        title: 'A priced exit, not a guess',
        body: 'Table sizes, egress, parallel-run months, and rebuild effort by asset type give finance a number to put against the contract, before anyone has to renegotiate.',
      },
      {
        title: 'Data that stays readable',
        body: 'An inventory shows which tables Delta, Iceberg, or Parquet readers open as they are, and which use features such as deletion vectors that outside engines may not support.',
      },
      {
        title: 'Lock-in found early',
        body: 'Governance policies, lineage, dashboards, and apps do not export as open assets. Knowing that now lets you choose where to build, or document a rebuild.',
      },
      {
        title: 'A phased path with a rollback',
        body: 'Running both platforms in parallel and moving one domain at a time lets each step be checked and reversed, instead of a single cutover weekend.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Data is the easy part.',
      body: 'Delta Lake and Apache Iceberg are open table formats with open-source readers. Managed and external tables both keep their files in your cloud storage.',
    },
    {
      title: 'Decision 1: how outside engines read.',
      body: 'Use the Iceberg REST catalog for engines you run, OpenSharing for other organizations and platforms, and direct file access for external tables with a plain reader.',
    },
    {
      title: 'Decision 2: move or read in place.',
      body: 'Read in place while both platforms run. Copy with DEEP CLONE or CTAS when the exit date is fixed or you want the files under your own control.',
    },
    {
      title: 'Check the table features.',
      body: 'Deletion vectors, column mapping, and type widening are reader features. An outside engine must support them, or you drop the feature before you export.',
    },
    {
      title: 'Decisions 3 and 4: pace and rebuild.',
      body: 'Phase the exit by domain rather than all at once. Re-platform Spark and SQL code, and rebuild dashboards, Genie Agents, serving endpoints, and apps on the target.',
    },
    {
      title: 'Decision 5: where governance lives.',
      body: 'Export grants and tags from information_schema. ABAC policies, governed tags, and lineage history do not carry over, so choose a catalog and rewrite them.',
    },
  ],
  prerequisites: [
    {
      slug: 'file-formats-delta-iceberg',
      title: 'JSON, CSV, Parquet, Delta, and Iceberg',
      why: 'Shows what each format writes to storage and which table features only one of them supports.',
    },
    {
      slug: 'iceberg-support',
      title: 'Apache Iceberg interoperability',
      why: 'Sets up the Iceberg REST catalog, credential vending, and the metastore setting that outside engines need.',
    },
    {
      slug: 'data-sharing',
      title: 'OpenSharing: Databricks-to-Databricks and to other platforms',
      why: 'Covers recipients, shares, and the egress cost when another platform reads your tables.',
    },
  ],
  sections: [
    {
      id: 'what-is-open',
      heading: 'What is open and what is not',
      prose:
        'Plan around three layers. Table data and table formats are open. Code splits in two: the open-source engines run anywhere, and the Databricks packaging around them (jobs, pipelines, serving) does not. Governance and AI/BI assets belong to the platform.',
      diagram: {
        type: 'matrix',
        title: 'Portability by asset type',
        description:
          'A matrix of fourteen asset types. Delta and Iceberg tables, Parquet files, and Spark code run as is. SQL and notebooks, Lakeflow pipelines, jobs, Unity Catalog grants, MLflow, and views need changes. ABAC policies, lineage history, serving endpoints, AI/BI dashboards, Genie Agents, and Databricks Apps are rebuilt.',
        corner: 'Asset',
        columns: ['Verdict', 'What carries over', 'What you redo'],
        rows: [
          {
            label: 'Delta Lake tables',
            sub: 'managed or external',
            cells: [
              {
                state: 'own',
                text: 'Runs as is',
                detail: 'Delta Lake is an open table format under the Linux Foundation, with open-source readers.',
              },
              { state: 'own', text: 'Data and history', sub: 'Parquet files plus log' },
              {
                state: 'optional',
                text: 'Check features',
                sub: 'deletion vectors, mapping',
                detail:
                  'Docs: deletion vectors, column mapping, and type widening are reader and writer features. The reader must support each one.',
              },
            ],
          },
          {
            label: 'Iceberg tables',
            sub: 'managed or UniForm',
            cells: [
              {
                state: 'own',
                text: 'Runs as is',
                detail:
                  'Managed Iceberg tables are read and written by Iceberg clients through the Unity Catalog REST catalog.',
              },
              { state: 'own', text: 'Data and metadata' },
              { state: 'none', text: 'Nothing to redo' },
            ],
          },
          {
            label: 'Parquet, CSV, JSON files',
            cells: [
              { state: 'own', text: 'Runs as is' },
              { state: 'own', text: 'Files and layout' },
              { state: 'none', text: 'Nothing to redo' },
            ],
          },
          {
            label: 'Spark code',
            sub: 'PySpark, Scala',
            cells: [
              {
                state: 'own',
                text: 'Runs as is',
                detail:
                  'Apache Spark APIs are the same in open-source Spark. Check dbutils and Databricks-only functions.',
              },
              { state: 'own', text: 'Transformations' },
              { state: 'optional', text: 'dbutils, secrets', sub: 'replace with your own' },
            ],
          },
          {
            label: 'SQL and notebooks',
            cells: [
              { state: 'optional', text: 'Needs changes' },
              { state: 'own', text: '.py, .sql, .ipynb', sub: 'source export' },
              { state: 'optional', text: 'Widgets, display', sub: 'Databricks-only SQL' },
            ],
          },
          {
            label: 'Lakeflow pipelines',
            cells: [
              {
                state: 'optional',
                text: 'Needs changes',
                detail:
                  'Databricks says Lakeflow pipelines extend and interoperate with Spark Declarative Pipelines. The docs do not list which features are Databricks-only.',
              },
              { state: 'own', text: 'SQL and Python logic' },
              { state: 'optional', text: 'Extensions', sub: 'check against Spark docs' },
            ],
          },
          {
            label: 'Jobs and schedules',
            cells: [
              { state: 'optional', text: 'Needs changes' },
              { state: 'own', text: 'Task graph as JSON' },
              { state: 'optional', text: 'Orchestrator DAGs', sub: 'Airflow, Dagster, cron' },
            ],
          },
          {
            label: 'MLflow models, runs',
            cells: [
              { state: 'optional', text: 'Needs changes' },
              { state: 'own', text: 'Runs, experiments, models', sub: 'mlflow-export-import' },
              { state: 'optional', text: 'Registry URIs, aliases' },
            ],
          },
          {
            label: 'Grants and tags',
            sub: 'Unity Catalog',
            cells: [
              { state: 'optional', text: 'Needs changes' },
              { state: 'own', text: 'Exports as rows', sub: 'information_schema' },
              { state: 'optional', text: 'Re-apply in target' },
            ],
          },
          {
            label: 'ABAC, governed tags',
            cells: [
              { state: 'none', text: 'Rebuild' },
              { state: 'optional', text: 'Intent only', sub: 'policy text' },
              { state: 'none', text: 'Rewrite policies' },
            ],
          },
          {
            label: 'Lineage history',
            cells: [
              { state: 'none', text: 'Rebuild' },
              { state: 'optional', text: 'Rows you export', sub: 'system tables, 1 year' },
              { state: 'none', text: 'Recapture in target' },
            ],
          },
          {
            label: 'Serving endpoints',
            cells: [
              { state: 'none', text: 'Rebuild' },
              { state: 'optional', text: 'The model artifact' },
              { state: 'none', text: 'Host and scale it' },
            ],
          },
          {
            label: 'AI/BI dashboards, Genie',
            cells: [
              { state: 'none', text: 'Rebuild' },
              { state: 'optional', text: 'The SQL queries', sub: 'and table comments' },
              { state: 'none', text: 'Rebuild in target BI' },
            ],
          },
          {
            label: 'Databricks Apps',
            cells: [
              { state: 'none', text: 'Rebuild' },
              { state: 'optional', text: 'App source code' },
              { state: 'none', text: 'Hosting, auth, resources' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Runs as is' },
          { state: 'optional', label: 'Needs changes' },
          { state: 'none', label: 'Rebuild' },
        ],
        caption:
          'Judgment from the Delta Lake, Iceberg, Unity Catalog, MLflow, and Databricks docs cited below. The first column is the verdict. Your workloads decide the real answer.',
      },
      points: [
        {
          strong: 'Delta Lake.',
          text: 'An open-source table format hosted by the Linux Foundation. Readers exist for Spark, Trino, Flink, DuckDB, and others, each at its own feature level.',
        },
        {
          strong: 'Apache Iceberg.',
          text: 'An Apache Software Foundation table format with a REST catalog specification. Unity Catalog implements that specification for outside engines.',
        },
        {
          strong: 'Unity Catalog OSS.',
          text: 'Apache 2.0 licensed with an OpenAPI specification, server, and clients, and a LF AI & Data Sandbox project. It implements the Iceberg REST catalog APIs and credential vending. It is a separate project from the Databricks product, so confirm which features your target needs.',
        },
      ],
      links: [
        { label: 'Delta Lake', url: 'https://delta.io/' },
        { label: 'Apache Iceberg', url: 'https://iceberg.apache.org/' },
        { label: 'Unity Catalog OSS', url: 'https://www.unitycatalog.io/' },
        {
          label: 'Delta Lake feature compatibility',
          url: 'https://docs.databricks.com/aws/en/delta/feature-compatibility',
        },
      ],
    },
    {
      id: 'data-location',
      heading: 'Where the files live',
      prose:
        'Managed and external tables both keep their data files in cloud storage. The difference is who controls the layout and the access path.',
      points: [
        {
          strong: 'Managed tables.',
          text: 'Unity Catalog stores the files in the managed storage location of the schema, catalog, or metastore, which you configure. Databricks does not support path-based access to managed tables, except in Compatibility Mode, because it bypasses Unity Catalog access controls. Table directories use generated IDs, so a path does not tell you which table it holds.',
        },
        {
          strong: 'External tables.',
          text: 'You pick the location, under a Unity Catalog external location. Any engine with access to that storage can read the files. Unity Catalog governs access only when the read goes through it.',
        },
        {
          strong: 'Dropped tables.',
          text: 'A dropped managed table is recoverable for 7 days by default. You can set the recovery period at the catalog or schema level to 0 (no recovery) or 7 to 30 days with RETAIN DROPPED TO, which is in Public Preview. Set it deliberately before a cleanup.',
        },
        {
          strong: 'Outside writers.',
          text: 'External Spark clients can create and write Unity Catalog managed Delta tables when catalog commits are enabled. The release notes mark this generally available in October 2026. External engines can also query views over Delta tables through the Unity REST API, generally available October 13, 2026.',
        },
      ],
      links: [
        { label: 'Unity Catalog managed tables', url: 'https://docs.databricks.com/aws/en/tables/managed' },
        {
          label: 'Databricks release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/',
        },
      ],
    },
    {
      id: 'access-paths',
      heading: 'How outside engines and platforms read the data',
      prose: 'Three paths cover almost every target. Pick one per consumer, not one for the whole company.',
      diagram: {
        type: 'flow',
        title: 'Access paths for outside readers',
        description:
          'Tables in cloud storage are read three ways. The Iceberg REST catalog serves engines such as Trino, Flink, and PyIceberg, with credential vending giving them short-lived storage credentials. OpenSharing serves other platforms and organizations. Direct file access serves any Delta or Parquet reader for external tables.',
        nodes: [
          {
            id: 'tables',
            label: 'Your tables',
            sub: 'Delta or Iceberg files',
            col: 0,
            row: 1,
            kind: 'store',
            domain: 'data',
            icon: 'database',
            detail:
              'Managed and external tables, stored as Delta Lake or Apache Iceberg in your cloud storage. Unity Catalog holds the metadata and the grants.',
          },
          {
            id: 'irc',
            label: 'Iceberg REST catalog',
            sub: '/api/2.1/unity-catalog',
            col: 1,
            row: 0,
            kind: 'highlight',
            domain: 'governance',
            icon: 'network',
            detail:
              'The catalog endpoint on the workspace host. It serves managed Iceberg tables, and Delta tables with Iceberg reads enabled. The metastore needs external data access on, and the reader needs EXTERNAL USE SCHEMA.',
          },
          {
            id: 'vend',
            label: 'Credential vending',
            sub: 'short-lived keys',
            col: 2,
            row: 0,
            domain: 'governance',
            icon: 'id-provider',
            detail:
              'Unity Catalog issues temporary storage credentials scoped to the table, so the outside engine holds no long-lived keys. The reader asks for them with the X-Iceberg-Access-Delegation header.',
          },
          {
            id: 'engines',
            label: 'Query engines',
            sub: 'Trino, Flink, PyIceberg',
            col: 3,
            row: 0,
            kind: 'surface',
            domain: 'data',
            icon: 'gear-slate',
            detail:
              'Engines you run that speak the Iceberg REST protocol. Read-only for Delta tables with Iceberg reads, read and write for managed Iceberg tables.',
          },
          {
            id: 'share',
            label: 'OpenSharing',
            sub: 'share and recipient',
            col: 1,
            row: 1,
            kind: 'highlight',
            domain: 'governance',
            icon: 'data-shares',
            detail:
              'A provider shares tables with a recipient on another platform or in another organization. Access is read-only and revocable, and it is audited.',
          },
          {
            id: 'platforms',
            label: 'Other platforms',
            sub: 'partners, other clouds',
            col: 3,
            row: 1,
            kind: 'surface',
            domain: 'neutral',
            icon: 'saas',
            detail:
              'Recipients that read through an open sharing client or a platform with built-in support. Cross-region or cross-cloud reads can add egress cost on the provider side.',
          },
          {
            id: 'files',
            label: 'Direct files',
            sub: 'external tables only',
            col: 1,
            row: 2,
            kind: 'highlight',
            domain: 'data',
            icon: 'data-file',
            detail:
              'Read the Delta or Parquet files straight from cloud storage with your own storage credentials. Unity Catalog grants do not apply to this path, so you own the access control.',
          },
          {
            id: 'readers',
            label: 'Delta and Parquet',
            sub: 'readers',
            col: 3,
            row: 2,
            kind: 'surface',
            domain: 'data',
            icon: 'cloud-database',
            detail:
              'Any engine with a Delta Lake or Parquet reader and access to the storage account. The reader must support every table feature the table uses.',
          },
        ],
        edges: [
          { from: 'tables', to: 'irc' },
          { from: 'tables', to: 'share' },
          { from: 'tables', to: 'files' },
          { from: 'irc', to: 'vend' },
          { from: 'vend', to: 'engines' },
          { from: 'share', to: 'platforms' },
          { from: 'files', to: 'readers' },
        ],
        legend: [
          { kind: 'store', label: 'Data' },
          { kind: 'highlight', label: 'Access path' },
          { kind: 'surface', label: 'Reader' },
        ],
        caption: 'The REST catalog and OpenSharing keep Unity Catalog in the loop. Direct files do not.',
      },
      options: {
        caption: 'How other engines read the data',
        rows: [
          {
            option: 'Iceberg REST catalog',
            when: 'Engines you run or trust, such as Trino, Flink, Spark, or PyIceberg, need live reads, and each can speak the Iceberg REST protocol.',
            tradeoffs:
              'Governance stays in Unity Catalog and credentials are short-lived. It needs external data access on the metastore, EXTERNAL USE SCHEMA, and an Iceberg client whose runtime matches your engine and Scala versions (the docs use 1.9.2 in their examples). Delta tables must have Iceberg reads on and are read-only. Views and foreign tables have limits.',
          },
          {
            option: 'OpenSharing',
            when: 'The reader is another organization, business unit, or platform, and you want a share and recipient to bound access without giving out a service principal.',
            tradeoffs:
              'Read-only and revocable, with audit through system tables. The provider pays for cross-region and cross-cloud egress. Sharing foreign Iceberg tables became generally available on September 11, 2026. Not a fit for engines that must write.',
          },
          {
            option: 'Direct files',
            when: 'The tables are external, the target is your own storage, and a Delta or Parquet reader is enough.',
            tradeoffs:
              'No Databricks in the read path and no per-query platform cost. It also drops Unity Catalog grants, masks, and audit, so you re-create access control on the storage. Managed tables do not support this path.',
          },
        ],
        recommendation:
          'Use the Iceberg REST catalog for engines you operate, OpenSharing for outside organizations and platforms, and direct files only for external tables where you accept owning the access control. Most exits use two of the three.',
      },
      links: [
        {
          label: 'Access Databricks tables from Iceberg clients',
          url: 'https://docs.databricks.com/aws/en/external-access/iceberg',
        },
        { label: 'Credential vending', url: 'https://docs.databricks.com/aws/en/external-access/credential-vending' },
        { label: 'OpenSharing', url: 'https://docs.databricks.com/aws/en/opensharing' },
        { label: 'PyIceberg', url: 'https://py.iceberg.apache.org/' },
      ],
    },
    {
      id: 'format-limits',
      heading: 'Features that outside readers may not support',
      prose:
        'A table is only as portable as its newest feature. Table features raise the reader protocol, and the docs state that most protocol upgrades are irreversible and might break existing readers or writers.',
      points: [
        {
          strong: 'Deletion vectors.',
          text: 'A reader and writer feature that needs minReaderVersion 3 and minWriterVersion 7. The docs list OSS Delta 2.3.0 or above as a supporting reader. You cannot enable deletion vectors on a table with Iceberg reads enabled, and Iceberg v2 reads do not support them. Iceberg v3 does.',
        },
        {
          strong: 'Column mapping.',
          text: 'A reader and writer feature. Enabling Iceberg reads at table creation turns it on automatically. On an existing table you set the column mapping mode yourself.',
        },
        {
          strong: 'Type widening.',
          text: 'A reader and writer feature with the same protocol requirements as deletion vectors.',
        },
        {
          strong: 'Iceberg reads on Delta.',
          text: 'Needs the table registered in Unity Catalog, column mapping on, and writes from Databricks Runtime 14.3 LTS or above. Access is read-only. It is not supported on materialized views or streaming tables, nor for VOID columns. Legacy change data feed has no Iceberg equivalent. The table must be read by name.',
        },
        {
          strong: 'External Iceberg clients.',
          text: 'They cannot create managed Iceberg tables with UUID, Fixed(L), TIME, or nested STRUCT types with required fields, and they cannot run maintenance such as expiring snapshots or removing orphan files.',
        },
        {
          strong: 'What the docs do not say.',
          text: 'Support for each feature in Trino, DuckDB, Snowflake, or other engines changes by release, and The Databricks docs give no matrix. Read the target engine release notes for every feature the inventory reports.',
        },
      ],
      links: [
        { label: 'Read Delta tables with Iceberg clients', url: 'https://docs.databricks.com/aws/en/delta/uniform' },
        { label: 'Deletion vectors', url: 'https://docs.databricks.com/aws/en/delta/deletion-vectors' },
        {
          label: 'Delta Lake feature compatibility',
          url: 'https://docs.databricks.com/aws/en/delta/feature-compatibility',
        },
      ],
    },
    {
      id: 'inventory',
      heading: 'Inventory first',
      prose:
        'Build the exit inventory before any other step. It turns the matrix above into a list of your own tables with a verdict each. Everything else, from egress cost to phase order, follows from that list.',
      steps: [
        {
          title: 'Read the catalog.',
          body: 'information_schema.tables gives the table type (MANAGED, EXTERNAL, VIEW, FOREIGN), the data source format, and the storage path for each table in a catalog.',
          code: `SELECT table_schema, table_name, table_type, data_source_format, storage_path
FROM <catalog>.information_schema.tables
WHERE table_schema <> 'information_schema';`,
        },
        {
          title: 'Read properties and details.',
          body: 'SHOW TBLPROPERTIES returns the table properties as key and value rows, including the UniForm and column mapping settings. DESCRIBE DETAIL returns the location, size in bytes, and the table features.',
          code: `SHOW TBLPROPERTIES <catalog>.<schema>.<table>;
DESCRIBE DETAIL <catalog>.<schema>.<table>;`,
        },
        {
          title: 'Give each table a verdict.',
          body: 'Plain Delta, Iceberg, and Parquet run as is. A table with reader features needs changes or a feature drop. Views, materialized views, and streaming tables are recreated or rebuilt.',
        },
        {
          title: 'Add size and workloads.',
          body: 'Sum the size per domain for the egress estimate, then list the jobs, pipelines, dashboards, and apps that read each domain. That list sets the phase order.',
        },
      ],
    },
    {
      id: 'move-data',
      heading: 'Move the data or read it in place',
      prose:
        'Reading in place leaves Databricks as the catalog and compute owner. Moving gives you the files, and a copy cost, and breaks that dependency.',
      options: {
        caption: 'Move the data or read it in place',
        rows: [
          {
            option: 'Read in place',
            when: 'Both platforms run in parallel, the data changes daily, and the target engine reads through the Iceberg REST catalog or OpenSharing.',
            tradeoffs:
              'No copy, no second copy to reconcile, and no egress for same-region reads. Databricks stays in the read path, so catalog calls, compute for sharing, and the contract continue. It cannot be your final state.',
          },
          {
            option: 'Deep clone to an external location',
            when: 'The exit date is fixed, or you want Delta files that you control in a bucket outside Unity Catalog managed storage.',
            tradeoffs:
              'A complete, independent copy of metadata and data, with incremental refresh for repeat runs. Cost is storage for the second copy plus read and egress charges. Streaming tables and materialized views cannot be sources, and managed Iceberg tables only support deep clone.',
          },
          {
            option: 'CTAS to Parquet or Iceberg',
            when: 'The target needs a different format, a filtered subset, or tables without Delta features.',
            tradeoffs:
              'Full control of the output and no feature carry-over. History, constraints, and table properties are not copied, and you re-create partitioning and clustering on the target.',
          },
          {
            option: 'Cloud storage copy of external files',
            when: 'External tables already sit in a bucket you own and need to move to another bucket or cloud.',
            tradeoffs:
              'Uses your cloud provider transfer tools and bypasses Databricks. You handle consistency: copy the data files and the Delta log together while writers are paused.',
          },
        ],
        recommendation:
          'Read in place during the parallel run, then deep clone each domain to storage you own a few weeks before its cutover and refresh it incrementally. Use CTAS only where the format has to change.',
      },
      examples: [
        {
          label: 'Deep clone a managed table to an external location',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE exit_catalog.sales.orders
  DEEP CLONE prod.sales.orders
  LOCATION 's3://<bucket>/exit/sales/orders';`,
          notes: [
            'The location must sit under an external location you can create tables in.',
            'Run it again to pick up changes since the last clone. CREATE OR REPLACE adds an incremental commit with only the new data, where CREATE TABLE IF NOT EXISTS would skip an existing table.',
            'Delta table history and Unity Catalog tags are not copied. Export the tags with the governance steps below.',
          ],
        },
        {
          label: 'Drop deletion vectors before an export',
          language: 'sql',
          code: `ALTER TABLE prod.sales.orders SET TBLPROPERTIES (delta.enableDeletionVectors = false);
REORG TABLE prod.sales.orders APPLY (PURGE);`,
          notes: [
            'REORG rewrites the files that carry deletion vector changes.',
            'ALTER TABLE ... DROP FEATURE deletionVectors removes the feature so readers without deletion vector support can open the table. The docs recommend Databricks Runtime 16.3 or above for DROP FEATURE. Older external clients may also need TRUNCATE HISTORY, which removes table history older than 24 hours.',
          ],
        },
        {
          label: 'Export a table as Parquet with CTAS',
          language: 'sql',
          code: `CREATE TABLE exit_catalog.sales.orders_parquet
  USING PARQUET
  LOCATION 's3://<bucket>/exit/sales/orders_parquet'
  AS SELECT * FROM prod.sales.orders;`,
        },
      ],
      links: [
        { label: 'CLONE', url: 'https://docs.databricks.com/aws/en/sql/language-manual/delta-clone' },
        { label: 'Deletion vectors', url: 'https://docs.databricks.com/aws/en/delta/deletion-vectors' },
      ],
    },
    {
      id: 'governance',
      heading: 'Metadata and governance',
      prose:
        'Grants, tags, comments, and table definitions are rows in information_schema, so you can export them. The policy engine around them is not portable.',
      table: {
        caption: 'What exports and what does not',
        columns: ['Item', 'Portability'],
        rows: [
          ['Table and column comments', 'Export from information_schema.tables and columns. Portable as text.'],
          ['Grants', 'Export from the catalog, schema, and table privilege views. Re-apply in the target catalog.'],
          [
            'Tags',
            'Export from table_tags, column_tags, and schema_tags. Governed tags are a Databricks feature, so keep the values and rebuild the governance.',
          ],
          [
            'Row filters and column masks',
            'Export the function definitions. They are SQL, but the target must enforce them.',
          ],
          [
            'ABAC policies',
            'Do not carry over. Record the intent and rewrite in the target. Cross-engine ABAC generally available in October 2026 lets supported outside engines read tables with policies enforced by Databricks serverless compute, so it keeps Databricks in the read path.',
          ],
          [
            'Lineage',
            'Catalog Explorer retains lineage captured after September 1, 2024. The lineage system tables keep a rolling one-year window. Export those rows before you cancel.',
          ],
          ['Audit log', 'system.access.audit has 365-day retention. Export what your records policy needs.'],
        ],
      },
      options: {
        caption: 'Keep Unity Catalog OSS or move governance elsewhere',
        rows: [
          {
            option: 'Unity Catalog OSS',
            when: 'You want the same three-level namespace, an Iceberg REST catalog, and credential vending without Databricks, and you can run a server.',
            tradeoffs:
              'Apache 2.0 with an open API, so existing clients keep working. The OSS server is a separate project, and the Databricks product has features, such as ABAC, that you cannot assume it has. You operate it, patch it, and secure it.',
          },
          {
            option: 'Another catalog',
            when: 'The target platform has its own catalog and governance, such as AWS Glue, Snowflake Horizon, or Polaris, and your engines already use it.',
            tradeoffs:
              'Fewer moving parts to run, and native integration with the target. You rewrite grants and masks in its model and lose Unity Catalog lineage continuity.',
          },
          {
            option: 'Storage-level control only',
            when: 'The remaining use is a small set of batch jobs on a few tables.',
            tradeoffs:
              'Simplest to run. Access is per bucket or prefix, with no column or row control and no table-level audit.',
          },
        ],
        recommendation:
          'Export grants, tags, and lineage rows on day one regardless of the choice. Choose the target catalog by what your engines already speak, and use Unity Catalog OSS when the Iceberg REST path and namespace should stay unchanged.',
      },
      examples: [
        {
          label: 'Export grants and tags to Delta tables you keep',
          language: 'sql',
          code: `CREATE OR REPLACE TABLE exit_catalog.audit.table_privileges AS
SELECT * FROM prod.information_schema.table_privileges;

CREATE OR REPLACE TABLE exit_catalog.audit.table_tags AS
SELECT * FROM prod.information_schema.table_tags;

CREATE OR REPLACE TABLE exit_catalog.audit.table_lineage AS
SELECT * FROM system.access.table_lineage;`,
          notes: [
            'Databricks discourages moving system table data outside the platform because it can expose sensitive data. Store the export in a location with the same access controls.',
          ],
        },
      ],
      links: [
        {
          label: 'Data lineage',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage',
        },
        {
          label: 'Attribute-based access control',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
        },
        { label: 'System tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' },
        { label: 'Unity Catalog OSS on GitHub', url: 'https://github.com/unitycatalog/unitycatalog' },
      ],
    },
    {
      id: 'code',
      heading: 'Code, pipelines, and AI assets',
      points: [
        {
          strong: 'Spark, SQL, and Python.',
          text: 'Transformations written against Apache Spark APIs run on open-source Spark. Replace dbutils, Databricks secrets, widgets, display, and any Databricks-only SQL function. Table names change if the target catalog uses a different namespace.',
        },
        {
          strong: 'Notebooks.',
          text: 'Export as source files (.py, .sql, .scala, .r), HTML, DBC archive, or .ipynb. Outputs travel with HTML, .ipynb, and DBC exports if you have not cleared them. A folder exports in bulk with the CLI (databricks workspace export-dir).',
        },
        {
          strong: 'Pipelines.',
          text: 'Lakeflow Spark Declarative Pipelines extend and interoperate with Apache Spark Declarative Pipelines, which is open source and documented in the Apache Spark docs (version 4.2.0 at the time of writing) with streaming tables, materialized views, temporary views, and a spark-pipelines CLI. The Spark docs list limits, for example no PIVOT in SDP SQL. The Databricks docs do not list which Lakeflow features are Databricks-only, so test each pipeline on open-source Spark before you plan on it.',
        },
        {
          strong: 'Jobs.',
          text: 'A job is a task graph with schedules, retries, and parameters. Export the JSON with the CLI (databricks jobs get) or generate a bundle, then map tasks to your orchestrator. The task code carries over. The scheduler does not.',
        },
        {
          strong: 'MLflow.',
          text: 'MLflow is Apache-2.0 licensed. The open-source mlflow-export-import project copies runs, experiments, and registered models, including Unity Catalog models, between tracking servers. Its limits are in the repository (for example, model version numbers are not guaranteed to be preserved and custom artifact locations are not imported), and its README was last updated in May 2024, so test it on your MLflow version.',
        },
        {
          strong: 'Rebuild.',
          text: 'Model serving endpoints, AI/BI dashboards, Genie Agents, and Databricks Apps run on Databricks infrastructure. Keep the underlying SQL, model artifacts, table comments, and app source, and rebuild the surface on the target.',
        },
      ],
      options: {
        caption: 'Rebuild or re-platform each workload type',
        rows: [
          {
            option: 'Re-platform (lift the code)',
            when: 'Spark and SQL jobs, notebooks, and MLflow runs that use standard APIs.',
            tradeoffs:
              'Lowest effort and risk. You edit imports and connection settings and keep the logic. Test results against the Databricks output before cutover.',
          },
          {
            option: 'Rewrite on the target',
            when: 'Pipelines using Lakeflow-specific features, or code tied to dbutils, widgets, or Databricks-only SQL.',
            tradeoffs:
              'Higher effort, but you drop dependencies you would otherwise carry for years. Budget for tests, since behavior can differ at the edges.',
          },
          {
            option: 'Rebuild',
            when: 'AI/BI dashboards, Genie Agents, serving endpoints, and Databricks Apps.',
            tradeoffs:
              'Full effort per asset, driven by how many you have. Re-using the SQL and table comments shortens it. Check whether users still need the asset before you rebuild it.',
          },
          {
            option: 'Retire',
            when: 'Assets with no usage in the last 90 days, from query history and app logs.',
            tradeoffs:
              'No cost and no risk, but you need an owner to sign off. Keep a copy of the definition for audit.',
          },
        ],
        recommendation:
          'Re-platform code that uses standard APIs, rewrite what depends on Databricks-only features, and rebuild dashboards and apps only after checking usage. Retire what nobody uses. Do this per domain, not per tool.',
      },
      examples: [
        {
          label: 'Export notebooks and a job definition',
          language: 'bash',
          code: `databricks workspace export-dir /Workspace/Users/<you>/project ./export --overwrite
databricks workspace export /Workspace/Users/<you>/project/etl --format JUPYTER --file etl.ipynb
databricks jobs get <job-id> --output json > job-<job-id>.json`,
        },
      ],
      links: [
        {
          label: 'Export and import notebooks',
          url: 'https://docs.databricks.com/aws/en/notebooks/notebook-export-import',
        },
        { label: 'Lakeflow Spark Declarative Pipelines', url: 'https://docs.databricks.com/aws/en/ldp/' },
        {
          label: 'Apache Spark Declarative Pipelines',
          url: 'https://spark.apache.org/docs/latest/declarative-pipelines-programming-guide.html',
        },
        { label: 'mlflow-export-import', url: 'https://github.com/mlflow/mlflow-export-import' },
      ],
    },
    {
      id: 'cost-sequencing',
      heading: 'Costs and sequencing',
      points: [
        {
          strong: 'Egress.',
          text: 'Copying out of a cloud region or provider is billed by your cloud, not by Databricks. Multiply the size column of the inventory by your provider rate. OpenSharing to another cloud or region adds egress on the provider side.',
        },
        {
          strong: 'Storage during the parallel run.',
          text: 'A deep clone is a second full copy until you retire the source. Plan to pay for both through the verification window.',
        },
        {
          strong: 'Compute on both sides.',
          text: 'Running both platforms in parallel doubles compute for the domains in flight. Move one domain at a time to keep that bounded.',
        },
        {
          strong: 'People.',
          text: 'Rebuild effort for dashboards, Genie Agents, and apps is usually the largest line. Count assets in the inventory and price per asset.',
        },
      ],
      options: {
        caption: 'Big-bang or phased exit',
        rows: [
          {
            option: 'Phased by domain',
            when: 'More than a few domains, shared tables, or dashboards that many people use.',
            tradeoffs:
              'Longer and costs parallel-run months. Each domain is verified and reversible, and the team learns on the first one. Shared tables need a read-in-place bridge until their consumers move.',
          },
          {
            option: 'Big-bang cutover',
            when: 'A small estate, a hard contract date, or a single domain with few consumers.',
            tradeoffs:
              'Shortest total time and no long parallel run. A failed cutover has no easy rollback, and every dependency has to be right on one weekend.',
          },
          {
            option: 'Read-only archive',
            when: 'Old data must stay queryable but no new work lands on the platform.',
            tradeoffs:
              'Cheap once compute is off. You still hold storage and need the catalog or files to stay accessible, and you need an owner for retention.',
          },
        ],
        recommendation:
          'Phase by domain. Start with a low-risk domain that has external tables, move reads first through the Iceberg REST catalog or OpenSharing, then writers, then retire the source. Keep a rollback until the verification window closes.',
      },
      steps: [
        {
          title: 'Inventory (weeks 1 to 2).',
          body: 'Run the exit inventory, list workloads by verdict, and size the egress and rebuild effort.',
        },
        {
          title: 'Read in place (weeks 2 to 6).',
          body: 'Stand up the target engine against the Iceberg REST catalog or OpenSharing and compare results with the Databricks output.',
        },
        {
          title: 'Move writers, domain by domain.',
          body: 'Deep clone the files, point the pipelines at the new location, and run both for the verification window.',
        },
        {
          title: 'Retire the source.',
          body: 'Stop the jobs, export the audit and lineage rows, confirm retention, and cancel only after the checklist below passes.',
        },
      ],
    },
    {
      id: 'before-cancel',
      heading: 'Check before you cancel',
      points: [
        {
          strong: 'Data retention.',
          text: 'Confirm that every table you need is copied and verified. A dropped managed table is recoverable only within its drop-retention window, 7 days by default.',
        },
        {
          strong: 'Keys and credentials.',
          text: 'Check customer-managed keys, storage credentials, and service principal secrets. Files encrypted with a key you control stay readable only while you hold that key.',
        },
        {
          strong: 'Audit and lineage exports.',
          text: 'System tables keep 365 days and lineage system tables a rolling year. Export the rows your records policy needs before access ends. Configurable retention for system tables is in Beta as of September 2026.',
        },
        {
          strong: 'Storage ownership.',
          text: 'Confirm the buckets and containers are in your account, with lifecycle rules that will not delete the copy.',
        },
        {
          strong: 'Contract terms.',
          text: 'Check notice periods and data-return terms with your account team. The public docs do not state them.',
        },
      ],
    },
    {
      id: 'run-it',
      heading: 'Run the inventory',
      prose:
        'The reference job reads information_schema and table properties for the shared schema and writes an exit_inventory table with format, managed or external, Iceberg readability, reader-side features, location, size, and a verdict. A second notebook prints the Iceberg REST endpoint and PyIceberg settings an outside engine uses. It does not connect to any outside system.',
      steps: [
        {
          title: '01_exit_inventory',
          body: 'Lists the objects in the schema, reads their properties and DESCRIBE DETAIL, and overwrites exit_inventory on every run.',
        },
        {
          title: '02_read_from_outside',
          body: 'Reports whether the metastore allows external data access, then prints the catalog URL and a PyIceberg configuration for the first Iceberg-readable table. A Required setup section covers the metastore setting and EXTERNAL USE SCHEMA.',
        },
      ],
    },
  ],
  related: [
    { slug: 'file-formats-delta-iceberg', title: 'JSON, CSV, Parquet, Delta, and Iceberg' },
    { slug: 'iceberg-support', title: 'Apache Iceberg interoperability' },
    { slug: 'data-sharing', title: 'OpenSharing: Databricks-to-Databricks and to other platforms' },
    { slug: 'legacy-conversion', title: 'Legacy workload migration' },
    { slug: 'external-integrations', title: 'Partner tool integrations' },
  ],
};
