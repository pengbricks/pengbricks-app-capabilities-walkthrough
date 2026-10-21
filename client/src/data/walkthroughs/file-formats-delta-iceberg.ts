import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'file-formats-delta-iceberg',
  area: 'General Guides',
  title: 'JSON, CSV, Parquet, Delta, and Iceberg',
  intro:
    'Use Delta as the default table format. Add Iceberg reads when other engines need to query the same data, and choose managed Iceberg when Iceberg is the contract. Land raw JSON and CSV files into Delta with Auto Loader or read_files, keep them as Unity Catalog managed tables, and let liquid clustering and predictive optimization maintain them. This page covers when to use each format, why the table formats differ from files, and the settings that matter in practice.',
  businessValue: {
    summary:
      'Delta is the default table format, with Iceberg access added only when other engines need the data. Platform owners get one copy, automatic maintenance, and queries that read less data than raw files.',
    outcomes: [
      {
        title: 'One copy for many engines',
        body: 'A Delta table with Iceberg reads enabled is readable by Iceberg clients through the Unity Catalog Iceberg REST catalog, without a second copy of the data.',
      },
      {
        title: 'Less tuning labor',
        body: 'Liquid clustering and predictive optimization on managed tables replace hand-tuned partitioning, compaction, and VACUUM.',
      },
      {
        title: 'Faster than raw files',
        body: 'Raw JSON and CSV lose types and cannot skip data. Landing them in Delta keeps types and lets engines skip data they do not need.',
      },
      {
        title: 'A clear standard to set',
        body: 'Use Delta by default and managed Iceberg when Iceberg is the contract. The rule keeps teams from picking formats case by case.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Delta is the default.',
      body: 'It has the widest feature set in Databricks: ACID commits, updates and merges, time travel, change data feed, deletion vectors, and the most optimizations.',
    },
    {
      title: 'Add Iceberg reads for interop.',
      body: 'A Delta table with Iceberg reads enabled is readable by Iceberg clients through the Unity Catalog Iceberg REST catalog, without a second copy of the data.',
    },
    {
      title: 'Choose managed Iceberg when Iceberg is the contract.',
      body: 'When other engines write to the table, or your standard is Iceberg, create a managed Iceberg table in Unity Catalog.',
    },
    {
      title: 'Ingest files into Delta, do not query them in place.',
      body: 'JSON and CSV lose types and cannot skip data. Land them with Auto Loader or read_files into a bronze Delta table.',
    },
    {
      title: 'Cluster, do not partition.',
      body: 'Use liquid clustering and predictive optimization on managed tables. They replace hand-tuned partitioning, compaction, and VACUUM.',
    },
  ],
  sections: [
    {
      id: 'decide',
      heading: 'Which format to use',
      prose: 'Pick by who reads and writes the data, not by habit.',
      options: {
        caption: 'Choosing a storage format',
        rows: [
          {
            option: 'Delta table',
            when: 'The default for tables that Databricks writes: bronze, silver, and gold layers, updates, and merges.',
            tradeoffs:
              'The widest feature set on Databricks, including row-level changes, time travel, and automatic maintenance on managed tables. Other engines read it through connectors or Iceberg reads.',
          },
          {
            option: 'Delta table with Iceberg reads',
            when: 'Databricks writes, but Snowflake, Trino, Flink, or another Iceberg client needs to read the same table.',
            tradeoffs:
              'One copy of the data serves both kinds of reader, and Iceberg clients get read-only access. It needs column mapping and Unity Catalog, and deletion vectors cannot be enabled on the same table on v2 compatibility.',
          },
          {
            option: 'Managed Iceberg table',
            when: 'Iceberg is the contract: external engines write to the table, or your platform standard is Iceberg.',
            tradeoffs:
              'Open writes from any engine that speaks the Iceberg REST catalog, with Unity Catalog as the catalog of record. Create tables with SQL, and check feature coverage for your workload, since liquid clustering on Iceberg is in Public Preview.',
          },
          {
            option: 'Raw files (Parquet, JSON, CSV)',
            when: 'Exchange files with a system that expects them, or land data before ingestion.',
            tradeoffs:
              'Easy to produce and read anywhere. There are no transactions, updates, or time travel, and JSON and CSV carry no types. Ingest them into Delta rather than keeping them as the query layer.',
          },
        ],
        recommendation:
          'Use Delta by default. Add Iceberg reads when another engine only needs to read, choose managed Iceberg when other engines must write, and keep raw files for exchange and landing only.',
      },
      links: [
        {
          label: 'Read Delta tables with Iceberg clients',
          url: 'https://docs.databricks.com/aws/en/delta/uniform',
          note: 'Iceberg reads, formerly UniForm.',
        },
        {
          label: 'What is Apache Iceberg in Databricks?',
          url: 'https://docs.databricks.com/aws/en/iceberg/',
        },
      ],
    },
    {
      id: 'ingest',
      heading: 'Ingest raw files into Delta',
      prose:
        'Text files are a source, not a destination. Use Auto Loader for continuous or scheduled loads of files that keep arriving, and read_files for ad hoc queries and one-time loads. Both infer a schema and can rescue columns that do not match.',
      examples: [
        {
          label: 'Incremental ingestion with a streaming table',
          language: 'sql',
          code: "CREATE OR REFRESH STREAMING TABLE bronze_orders AS\nSELECT * FROM STREAM read_files(\n  '/Volumes/<catalog>/<schema>/landing/orders/',\n  format => 'json'\n);",
          notes: [
            'Each run processes only new files. Use this in a Lakeflow Spark Declarative Pipeline or as a Databricks SQL streaming table.',
            'Keep the raw columns in bronze and cast types in silver.',
          ],
        },
        {
          label: 'Query files in place with read_files',
          language: 'sql',
          code: "SELECT region, sum(amount)\nFROM read_files(\n  '/Volumes/<catalog>/<schema>/landing/csv',\n  format => 'csv',\n  header => true,\n  inferSchema => true\n)\nGROUP BY region;",
          notes: ["For JSON use format => 'json'. For Parquet the schema comes from the file footers."],
        },
      ],
      links: [
        {
          label: 'Auto Loader',
          url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader',
        },
        {
          label: 'read_files',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/read_files',
        },
      ],
    },
    {
      id: 'compare',
      heading: 'What each format gives a reader',
      prose:
        'Text formats carry no types and cannot skip files. Parquet adds columnar storage and types. Delta and Iceberg add a metadata layer on top of Parquet, which brings statistics-based skipping, transactions, updates, and time travel.',
      diagram: {
        type: 'matrix',
        title: 'Formats compared',
        description:
          'JSON and CSV are text with no schema, no column pruning, no data skipping, and no updates. Parquet is columnar with typed schema and prunes columns, but it is a plain folder with no updates or time travel. Delta and Iceberg add data skipping from statistics, ACID commits, updates, deletes, time travel, and schema evolution.',
        corner: 'Format ↓ · Feature →',
        columns: ['Types kept', 'Column pruning', 'File skipping', 'Updates, ACID', 'Time travel'],
        rows: [
          {
            label: 'JSON',
            sub: 'text, nested',
            cells: [
              { state: 'none', text: 'Inferred' },
              { state: 'none', text: 'Parse all' },
              { state: 'none', text: 'No' },
              { state: 'none', text: 'No' },
              { state: 'none', text: 'No' },
            ],
          },
          {
            label: 'CSV',
            sub: 'text, flat',
            cells: [
              { state: 'none', text: 'Inferred' },
              { state: 'none', text: 'Parse all' },
              { state: 'none', text: 'No' },
              { state: 'none', text: 'No' },
              { state: 'none', text: 'No' },
            ],
          },
          {
            label: 'Parquet folder',
            sub: 'columnar files',
            cells: [
              { state: 'own', text: 'In footer' },
              { state: 'own', text: 'Yes' },
              { state: 'optional', text: 'Row groups' },
              { state: 'none', text: 'No' },
              { state: 'none', text: 'No' },
            ],
          },
          {
            label: 'Delta table',
            sub: 'Parquet + log',
            cells: [
              { state: 'own', text: 'Enforced' },
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Min/max stats' },
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Yes' },
            ],
          },
          {
            label: 'Iceberg table',
            sub: 'Parquet + metadata',
            cells: [
              { state: 'own', text: 'Enforced' },
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Min/max stats' },
              { state: 'own', text: 'Yes' },
              { state: 'own', text: 'Yes' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Supported' },
          { state: 'optional', label: 'Partly' },
          { state: 'none', label: 'Not available' },
        ],
      },
      points: [
        {
          strong: 'Schema inference is a guess.',
          text: 'JSON and CSV carry no types, so Spark samples the files. CSV returns decimals as double, and JSON returns dates and timestamps as strings. Set the schema explicitly, or cast in silver.',
        },
        {
          strong: 'Nested data.',
          text: 'The CSV writer refuses struct and array columns. JSON keeps nesting but loses the declared field order and types.',
        },
        {
          strong: 'Size and speed come from encoding and skipping.',
          text: 'Columnar, compressed formats are many times smaller than text. Delta and Iceberg read only the files whose statistics match a filter. Benchmark on your own data, because small tables hide the difference.',
        },
        {
          strong: 'Only tables change rows safely.',
          text: 'UPDATE, DELETE, and MERGE are not supported on a plain Parquet folder, and concurrent writers to a folder can overwrite each other. Delta and Iceberg commit atomically.',
        },
      ],
    },
    {
      id: 'features',
      heading: 'What only the table formats do',
      points: [
        {
          strong: 'UPDATE, DELETE, MERGE.',
          text: 'Row-level changes with ACID commits. This is what makes change data capture and slowly changing dimensions possible.',
        },
        {
          strong: 'Time travel.',
          text: 'Query an earlier version with VERSION AS OF or TIMESTAMP AS OF, and restore with RESTORE. Retention is bounded by VACUUM.',
        },
        {
          strong: 'Schema evolution and enforcement.',
          text: 'ALTER TABLE ADD COLUMN works in place, and a write with an unexpected column is rejected instead of silently changing the table.',
        },
        {
          strong: 'ACID.',
          text: 'A failed write leaves the table unchanged, and readers see either the old or the new data, never a mix.',
        },
      ],
    },
    {
      id: 'tables',
      heading: 'Managed tables, layout, and retention',
      prose:
        'Default to Unity Catalog managed tables. They get automatic maintenance and the best performance, and Unity Catalog controls the storage.',
      points: [
        {
          strong: 'Managed over external.',
          text: 'Use managed tables unless another system must own the storage path. External tables keep your files where they are, but you maintain them yourself.',
        },
        {
          strong: 'Liquid clustering, not partitioning.',
          text: 'Databricks recommends liquid clustering for all new tables. Cluster by the columns you filter on, and change them later without rewriting the table. Partitioning fixes the layout at creation and invites small files. Liquid clustering is GA for Delta; for Iceberg tables it is in Public Preview.',
        },
        {
          strong: 'Predictive optimization.',
          text: 'It runs OPTIMIZE, VACUUM, and ANALYZE for you on managed Delta and Iceberg tables. Check that it is on for your account and catalogs.',
        },
        {
          strong: 'VACUUM and retention.',
          text: 'VACUUM removes data files older than the retention threshold, 7 days by default. Time travel cannot reach past it, so match retention to your recovery and audit needs, and keep it long enough for readers and streams.',
        },
        {
          strong: 'Deletion vectors.',
          text: 'Deletion vectors speed up row-level changes in Delta. They cannot be enabled on a table with Iceberg reads (v2 compatibility). Run REORG to purge them before you enable Iceberg reads. Iceberg v3 supports deletion vectors natively.',
        },
      ],
      examples: [
        {
          label: 'Create a clustered Delta table',
          language: 'sql',
          code: 'CREATE TABLE main.sales.orders (\n  order_id BIGINT, order_date DATE, region STRING, amount DECIMAL(12,2)\n) CLUSTER BY (order_date, region);',
          notes: ['Use CLUSTER BY AUTO to let Databricks choose and adjust the clustering keys.'],
        },
      ],
      options: {
        caption: 'Choosing a data layout for a new table',
        rows: [
          {
            option: 'Liquid clustering with chosen keys (CLUSTER BY columns)',
            when: 'You know which columns queries filter and join on, such as order_date and region.',
            tradeoffs:
              'Fast data skipping on the keys you pick, and you can change keys later without rewriting existing data. You pick the keys, and a poor choice means less skipping until you change them. Generally available for Delta, and in Public Preview for Iceberg tables.',
          },
          {
            option: 'Automatic liquid clustering (CLUSTER BY AUTO)',
            when: 'Query patterns are unknown or change often, and the table is a Unity Catalog managed table.',
            tradeoffs:
              'Databricks analyzes the query workload and picks and adapts keys, only when the predicted savings outweigh the clustering cost. It requires predictive optimization, works only on managed tables, runs asynchronously, and may not choose keys for small tables.',
          },
          {
            option: 'Partitioning',
            when: 'An outside tool needs a directory layout, or you are keeping an existing partitioned table that works.',
            tradeoffs:
              'The layout is fixed at creation and is hard to change. Choosing a high-cardinality column creates many small files. Databricks recommends liquid clustering for all new tables.',
          },
        ],
        recommendation:
          'Use CLUSTER BY AUTO on managed tables when you cannot name the filter columns, and explicit CLUSTER BY keys when you can. Keep partitioning only for compatibility with other tools.',
      },
      links: [
        {
          label: 'Liquid clustering',
          url: 'https://docs.databricks.com/aws/en/delta/clustering',
        },
        {
          label: 'Predictive optimization',
          url: 'https://docs.databricks.com/aws/en/optimizations/predictive-optimization',
        },
        {
          label: 'VACUUM',
          url: 'https://docs.databricks.com/aws/en/delta/vacuum',
        },
      ],
    },
    {
      id: 'layout',
      heading: 'Where the metadata lives',
      prose:
        'A folder is only data files. A table adds layers of metadata that say which files are current and what is in them.',
      diagram: {
        type: 'flow',
        title: 'Files versus table metadata',
        description:
          'A plain folder holds only Parquet files. A Delta table adds a _delta_log folder of JSON commits and Parquet checkpoints that list the data files and their statistics. An Iceberg table adds a metadata.json that points to a manifest list, which points to manifests that list the data files. All three end in Parquet data files.',
        lanes: [
          { label: 'Plain folder', fromRow: 0, toRow: 0 },
          { label: 'Delta table', fromRow: 1, toRow: 1 },
          { label: 'Iceberg table', fromRow: 2, toRow: 2 },
        ],
        nodes: [
          { id: 'folder', label: 'Folder', sub: 'no metadata', col: 0, row: 0 },
          { id: 'files', label: 'Parquet files', sub: 'the only truth', col: 3, row: 0, kind: 'store' },
          { id: 'table', label: 'Delta table', sub: 'Unity Catalog', col: 0, row: 1, kind: 'surface' },
          { id: 'commits', label: '_delta_log JSON', mono: true, sub: 'one file per commit', col: 1, row: 1 },
          { id: 'ckpt', label: 'Checkpoint', sub: 'state in one Parquet', col: 2, row: 1 },
          { id: 'dfiles', label: 'Parquet files', sub: 'with min/max stats', col: 3, row: 1, kind: 'store' },
          { id: 'meta', label: 'metadata.json', mono: true, sub: 'schema, snapshots', col: 0, row: 2, kind: 'surface' },
          { id: 'mlist', label: 'Manifest list', sub: 'one per snapshot', col: 1, row: 2 },
          { id: 'manifest', label: 'Manifests', sub: 'file lists and stats', col: 2, row: 2 },
          { id: 'ifiles', label: 'Parquet files', sub: 'same format', col: 3, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'folder', to: 'files', label: 'list directory' },
          { from: 'table', to: 'commits' },
          { from: 'commits', to: 'ckpt', label: 'every N commits' },
          { from: 'ckpt', to: 'dfiles' },
          { from: 'meta', to: 'mlist' },
          { from: 'mlist', to: 'manifest' },
          { from: 'manifest', to: 'ifiles' },
        ],
        legend: [
          { kind: 'surface', label: 'Entry point' },
          { kind: 'store', label: 'Data files' },
        ],
      },
    },
    {
      id: 'interop',
      heading: 'Interoperability',
      prose:
        'Both table formats store Parquet, so the choice is about metadata and the engines that read it. Iceberg reads write Iceberg metadata beside a Delta table, so one copy of the data serves both kinds of client.',
      points: [
        {
          strong: 'Iceberg reads (formerly UniForm).',
          text: 'Iceberg clients get read-only access to the Delta table through the Unity Catalog Iceberg REST catalog. Requires column mapping and Unity Catalog.',
        },
        {
          strong: 'Pick Delta',
          text: 'when Databricks is the main engine and you want the widest feature set.',
        },
        {
          strong: 'Pick managed Iceberg',
          text: 'when other engines must write through the Iceberg catalog, or Iceberg is your standard. Create it with SQL: managed Iceberg tables reject Delta-style DataFrame writes.',
        },
      ],
      examples: [
        {
          label: 'Enable Iceberg reads on an existing Delta table',
          language: 'sql',
          code: "ALTER TABLE main.sales.orders SET TBLPROPERTIES (\n  'delta.columnMapping.mode' = 'name',\n  'delta.enableIcebergCompatV2' = 'true',\n  'delta.universalFormat.enabledFormats' = 'iceberg'\n);\n\n-- Tables with deletion vectors:\nREORG TABLE main.sales.orders\n  APPLY (UPGRADE UNIFORM (ICEBERG_COMPAT_VERSION = 2));",
          notes: ['Iceberg clients get read-only access to the table.'],
        },
      ],
    },
  ],
  related: [
    { slug: 'iceberg-support', title: 'Apache Iceberg interoperability' },
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
  ],
};
