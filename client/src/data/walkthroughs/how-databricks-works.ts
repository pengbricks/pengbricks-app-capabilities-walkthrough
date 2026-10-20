import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'how-databricks-works',
  area: 'Foundations',
  title: 'How Databricks works',
  intro:
    'Databricks keeps data and compute apart. Tables are open-format files in cloud object storage, compute is started when work arrives and stopped when it ends, and Unity Catalog sits over both so every engine sees the same tables and the same permissions. This page covers those three pieces and how they fit.',
  businessValue: {
    summary:
      'Data stays in open files in your own cloud storage while compute starts and stops with the work. Finance pays for compute only while it runs, and every team queries the same governed copy.',
    outcomes: [
      {
        title: 'Pay for work, not idle time',
        body: 'Compute bills in DBUs only while it runs, and serverless needs no cluster sizing. Idle workloads stop costing compute, and tagged usage in system.billing.usage shows which team spent what.',
      },
      {
        title: 'One copy, no extracts',
        body: 'A SQL warehouse, a notebook, and a pipeline read the same table. Analysts and data scientists stop exporting files and reconciling copies.',
      },
      {
        title: 'Data stays portable',
        body: 'Tables are Delta or Iceberg files in your ADLS, S3, or GCS account. Stopping or replacing compute deletes nothing, so changing an engine does not require a data migration.',
      },
      {
        title: 'Less table upkeep',
        body: 'Predictive optimization runs OPTIMIZE, VACUUM, and ANALYZE on Unity Catalog managed tables, so engineers spend less time writing and watching maintenance jobs.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Data lives in object storage.',
      body: 'Tables are Delta or Iceberg: Parquet data files plus table metadata (a transaction log for Delta, metadata files for Iceberg), stored in ADLS, S3, or GCS. Nothing about the table is locked inside a running cluster.',
    },
    {
      title: 'Compute is separate and disposable.',
      body: 'Notebooks, jobs, pipelines, and SQL warehouses each start compute, read the tables, and shut down. Stopping compute deletes no data.',
    },
    {
      title: 'Many engines, one copy.',
      body: 'A SQL warehouse, a Python notebook, and a pipeline can read the same table at once. There is no export step between them.',
    },
    {
      title: 'The control plane runs the service.',
      body: 'Databricks hosts the web UI, job scheduler, and Unity Catalog. Your data is processed on the compute plane, serverless or in your own cloud account.',
    },
    {
      title: 'Default to managed tables and serverless.',
      body: 'Unity Catalog managed tables get predictive optimization, which runs OPTIMIZE, VACUUM, and ANALYZE for you. Serverless compute needs no cluster sizing or runtime upgrades.',
    },
    {
      title: 'You pay for each separately, so tag the spend.',
      body: 'Compute is billed in DBUs only while it runs. Storage is billed by the cloud provider. Attach serverless usage policies and tags to workloads, then report from system.billing.usage.',
    },
  ],
  sections: [
    {
      id: 'planes',
      heading: 'Control plane, compute plane, storage',
      prose:
        'A request starts in the control plane, runs on compute in the compute plane, and reads or writes files in storage. Unity Catalog checks every read and write, whichever compute makes it.',
      diagram: {
        type: 'flow',
        title: 'Where each part runs',
        description:
          'Users reach the workspace UI, APIs, and job scheduler in the Databricks control plane, where Unity Catalog also runs. The control plane starts compute in the compute plane: serverless compute managed by Databricks, or classic clusters in your cloud account. Both kinds of compute read and write Delta and Iceberg tables in cloud object storage, and Unity Catalog governs every read and write.',
        lanes: [
          { label: 'Control plane', fromRow: 0, toRow: 0 },
          { label: 'Compute plane', fromRow: 1, toRow: 1 },
          { label: 'Storage', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'user', label: 'Users and tools', sub: 'UI, API, BI, IDE', col: 0, row: 0, kind: 'surface' },
          { id: 'workspace', label: 'Workspace', sub: 'UI, jobs, notebooks', col: 1, row: 0 },
          { id: 'uc', label: 'Unity Catalog', sub: 'names, grants, lineage', col: 2, row: 0, kind: 'highlight' },
          { id: 'classic', label: 'Classic compute', sub: 'in your cloud account', col: 0, row: 1 },
          { id: 'serverless', label: 'Serverless compute', sub: 'managed by Databricks', col: 1, row: 1 },
          { id: 'tables', label: 'Delta and Iceberg', sub: 'Parquet in ADLS, S3, GCS', col: 1, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'user', to: 'workspace' },
          { from: 'workspace', to: 'serverless', label: 'starts' },
          { from: 'serverless', to: 'tables' },
          { from: 'classic', to: 'tables', dashed: true },
          { from: 'uc', to: 'tables', label: 'governs' },
        ],
        legend: [
          { kind: 'highlight', label: 'Governance for every engine' },
          { kind: 'store', label: 'Data at rest' },
          { kind: 'dashed', label: 'Optional classic path' },
        ],
      },
    },
    {
      id: 'separation',
      heading: 'Why compute and storage are separate',
      prose:
        'In a traditional warehouse the database owns its disks, so more data means a bigger server. Here the files stay put and you size compute for the work in front of you.',
      table: {
        caption: 'Coupled versus separated',
        columns: ['Coupled database', 'Databricks lakehouse'],
        rows: [
          ['Data sits on the server’s disks', 'Data sits in object storage you own'],
          ['Scale the server to store more', 'Storage grows on its own; compute is sized per job'],
          ['One engine reads the data', 'SQL, Python, Scala, R, and pipelines read the same tables'],
          ['Idle server still costs money', 'Compute stops when idle; only storage is billed'],
          ['Proprietary file format', 'Open Delta and Iceberg formats any engine can read'],
        ],
      },
    },
    {
      id: 'lakehouse',
      heading: 'What “lakehouse” means',
      points: [
        {
          strong: 'Lake storage.',
          text: 'Cheap object storage that holds structured tables and unstructured files, such as PDFs and images, in volumes.',
        },
        {
          strong: 'Warehouse guarantees.',
          text: 'ACID transactions, schemas, time travel, and fast SQL come from the table format’s metadata layer (the Delta transaction log, or Iceberg metadata files), not from a separate database.',
        },
        {
          strong: 'One governance layer.',
          text: 'Unity Catalog grants, lineage, and audit cover tables, files, models, and functions alike.',
        },
      ],
    },
    {
      id: 'compute',
      heading: 'Which compute to pick',
      prose:
        'Every option reads the same tables. Choose by workload, and start with serverless: it starts in seconds, scales on its own, and has no clusters to manage.',
      diagram: {
        type: 'matrix',
        title: 'Compute by workload',
        description:
          'SQL warehouses serve SQL queries, dashboards, and BI tools. Serverless notebooks and jobs run Python and SQL code and scheduled work. Lakeflow Spark Declarative Pipelines run batch and streaming ETL. Classic clusters are optional for workloads that need custom machines or libraries serverless does not support.',
        corner: 'Compute ↓ · Use →',
        columns: ['SQL and BI', 'Notebooks and jobs', 'Pipelines'],
        rows: [
          {
            label: 'SQL warehouse',
            sub: 'serverless',
            cells: [
              { state: 'own', text: 'Primary' },
              { state: 'optional', text: 'SQL tasks' },
              { state: 'optional', text: 'MVs, streaming tables' },
            ],
          },
          {
            label: 'Serverless compute',
            sub: 'notebooks, jobs',
            cells: [
              { state: 'optional', text: 'Ad hoc SQL' },
              { state: 'own', text: 'Primary' },
              { state: 'none', text: 'No' },
            ],
          },
          {
            label: 'Lakeflow pipeline',
            sub: 'serverless',
            cells: [
              { state: 'none', text: 'No' },
              { state: 'optional', text: 'As a job task' },
              { state: 'own', text: 'Primary' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Built for this' },
          { state: 'optional', label: 'Supported' },
          { state: 'none', label: 'Not used' },
        ],
      },
    },
    {
      id: 'defaults',
      heading: 'Defaults to start with',
      prose: 'These choices remove most day-to-day tuning and make cost visible from the first workload.',
      points: [
        {
          strong: 'Managed tables.',
          text: 'Let Unity Catalog own the storage layout. Managed tables get predictive optimization (automatic OPTIMIZE, VACUUM, and ANALYZE) and liquid clustering in place of manual partitioning and file compaction. Use external tables only when another system must own the files.',
        },
        {
          strong: 'Serverless first.',
          text: 'Run SQL warehouses, jobs, notebooks, and pipelines on serverless compute. Fall back to classic clusters only for a library, instance type, or network path serverless does not support.',
        },
        {
          strong: 'Attribute cost on day one.',
          text: 'Apply serverless usage policies so serverless usage carries a tag, add custom tags to classic compute and warehouses, and query system.billing.usage by those tags for chargeback.',
        },
        {
          strong: 'One metastore per region, many workspaces.',
          text: 'Separate dev, staging, and prod with catalogs bound to workspaces, not with separate copies of the data layer.',
        },
      ],
      links: [
        { label: 'Predictive optimization', url: 'https://docs.databricks.com/aws/en/optimizations/predictive-optimization' },
        { label: 'Serverless usage policies', url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies' },
        { label: 'Billable usage system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing' },
      ],
    },
    {
      id: 'try-it',
      heading: 'See it for yourself',
      steps: [
        {
          title: 'Query a table from SQL',
          body: 'Open the SQL editor on a serverless warehouse and query a sample table.',
          code: 'SELECT * FROM samples.nyctaxi.trips LIMIT 10;',
        },
        {
          title: 'Read the same table from Python',
          body: 'In a notebook on serverless compute, read it again. Same table, different engine, no copy.',
          code: "spark.table('samples.nyctaxi.trips').groupBy('pickup_zip').count().display()",
        },
        {
          title: 'Look at the files',
          body: 'DESCRIBE DETAIL shows the table’s storage location, format, and file count. Stop the warehouse and run it again later: the files are unchanged.',
          code: 'DESCRIBE DETAIL samples.nyctaxi.trips;',
        },
      ],
    },
  ],
  related: [
    { slug: 'unity-catalog-basics', title: 'Unity Catalog basics' },
    { slug: 'medallion-architecture', title: 'Medallion architecture' },
    { slug: 'file-formats-delta-iceberg', title: 'JSON, CSV, Parquet, Delta, and Iceberg' },
    { slug: 'compute-capacity-management', title: 'Compute and capacity management' },
  ],
};
