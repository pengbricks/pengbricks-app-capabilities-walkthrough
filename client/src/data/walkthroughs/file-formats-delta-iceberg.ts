import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'file-formats-delta-iceberg',
  area: 'General Guides',
  title: 'JSON, CSV, Parquet, Delta, and Iceberg',
  intro:
    'One generated dataset of 1 million orders is written as JSON, CSV, and Parquet files, a Delta table, and a managed Iceberg table. The job measures size, inferred types, and what a selective query reads, then tries UPDATE, time travel, schema changes, and concurrent writes on each. Every number on this page comes from the job run.',
  shortVersion: [
    {
      title: 'Size follows the encoding.',
      body: 'The same rows take 293 MB as JSON, 188 MB as CSV, 35 MB as Parquet, and about 26 MB as Delta or Iceberg, which default to zstd.',
    },
    {
      title: 'Text formats lose types.',
      body: 'CSV returns every decimal as double and cannot hold nested values. JSON turns dates and timestamps into strings, decimals into doubles, and int into bigint.',
    },
    {
      title: 'Only tables skip files.',
      body: 'A one-day filter reads 1 of 8 files in Delta and Iceberg and prunes 7. The Parquet folder and CSV open all 8, and CSV reads about 199 MB.',
    },
    {
      title: 'Only tables change rows safely.',
      body: 'UPDATE, DELETE, and MERGE fail on a Parquet folder. Two writers overwriting one folder left 900,000 rows; Delta and Iceberg kept exactly one writer.',
    },
    {
      title: 'Both table formats are Parquet underneath.',
      body: 'Delta keeps a _delta_log of JSON commits and checkpoints. Iceberg keeps metadata.json, a manifest list, and manifests. UniForm writes both over the same files.',
    },
  ],
  sections: [
    {
      id: 'dataset',
      heading: 'One dataset, written five ways',
      prose:
        'Orders have a date, a timestamp, decimals, two nullable columns, a struct, and an array of structs. They are range-partitioned by order_date, so every format gets the same eight files of about the same rows. Every write overwrites, so a rerun gives the same counts.',
      steps: [
        {
          title: 'Generate',
          body: 'The sample-data generator builds the flat columns from the use-case spec. The notebook adds the nested ones.',
        },
        {
          title: 'Write',
          body: 'JSON, CSV, and Parquet go to a Unity Catalog volume folder. Delta uses saveAsTable. Iceberg uses CREATE TABLE ... USING ICEBERG, because the DataFrame writer is rejected for managed Iceberg.',
        },
        {
          title: 'Record',
          body: 'Each run appends file counts, bytes, and timings to ff_results, a run log that grows.',
        },
      ],
      examples: [
        {
          label: 'Query files in place with read_files',
          language: 'sql',
          code: "SELECT region, sum(amount)\nFROM read_files(\n  '/Volumes/<catalog>/<schema>/format_compare/csv',\n  format => 'csv',\n  header => true,\n  inferSchema => true\n)\nGROUP BY region;",
          notes: ["For JSON use format => 'json'. For Parquet the schema comes from the file footers."],
        },
      ],
    },
    {
      id: 'compare',
      heading: 'What each format gives a reader',
      prose:
        'The matrix summarizes the measured differences. The notebooks record the numbers in ff_results, and the one-pager repeats them with the full comparison.',
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
            sub: '293 MB, 8 files',
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
            sub: '188 MB, 8 files',
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
            sub: '35 MB, 8 files',
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
            sub: '26 MB, 8 files',
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
            sub: '26 MB, 8 files',
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
        caption: 'Sizes are the bytes the job measured for the same 1,000,000 rows.',
      },
      points: [
        {
          strong: 'Schema inference.',
          text: 'JSON and CSV carry no types, so Spark samples the files. CSV returns decimal(10,2), decimal(5,2), and decimal(12,2) as double. JSON returns int as bigint, date and timestamp as string, and decimals as double.',
        },
        {
          strong: 'Nested data.',
          text: 'The CSV writer refuses struct and array columns, so the guide stores them as JSON text. JSON keeps the nesting but orders struct fields alphabetically.',
        },
        {
          strong: 'Query cost.',
          text: 'At 1 million rows the median query takes 0.47 to 0.54 seconds on every format except CSV, at 1.0 second. Scan metrics from system.query.history show the difference: CSV reads 8 of 8 files and 199 MB; Parquet opens 8 files but reads about 3 MB; Delta and Iceberg read 1 file and prune 7. JSON reports no scan metrics.',
        },
      ],
    },
    {
      id: 'features',
      heading: 'What only the table formats do',
      prose:
        'The same operations run against a Parquet folder, a Delta table, and a managed Iceberg table built from the same 20,000 rows. The main tables are never touched.',
      points: [
        {
          strong: 'UPDATE, DELETE, MERGE.',
          text: 'On a Parquet folder Unity Catalog returns UC_COMMAND_NOT_SUPPORTED for UPDATE and MERGE, and a permission error for DELETE. Delta and Iceberg run all three.',
        },
        {
          strong: 'Time travel.',
          text: 'DESCRIBE HISTORY lists four versions on each table. VERSION AS OF 0 returns the original 20,000 rows, including the one deleted later. A folder has no versions.',
        },
        {
          strong: 'Schema evolution and enforcement.',
          text: 'ALTER TABLE ADD COLUMN works on both tables. An insert with an extra column is rejected. A Parquet folder accepts a file with a different schema, and readers then disagree about the columns.',
        },
        {
          strong: 'ACID.',
          text: "A failed write leaves each table at 300,000 rows. Readers during an overwrite saw only 300,000 or 600,000. Two writers on one folder produced a mix of both; tables ended with exactly one writer's data.",
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
        caption:
          'Managed table storage cannot be listed, so the job lists a Delta table at a volume path and reads Iceberg through its REST catalog.',
      },
    },
    {
      id: 'interop',
      heading: 'Interoperability and choosing',
      prose:
        'Both table formats store Parquet, so the choice is about metadata and the engines that read it. Managed Iceberg tables are generally available in Unity Catalog, and UniForm remains the way to expose a Delta table to Iceberg readers.',
      points: [
        {
          strong: 'UniForm.',
          text: 'A Delta table with Iceberg reads enabled writes Iceberg metadata beside its _delta_log. The job confirms the Iceberg side lists the same Parquet files and PyIceberg reads the same 1,000,000 rows.',
        },
        {
          strong: 'Pick Delta',
          text: 'when Databricks is the main engine and you want the widest feature set, such as deletion vectors and change data feed.',
        },
        {
          strong: 'Pick Iceberg',
          text: 'when other engines must write or read through an Iceberg catalog as the primary contract. Managed Iceberg tables reject Delta-style DataFrame writes, so use SQL.',
        },
      ],
      examples: [
        {
          label: 'Enable Iceberg reads on an existing Delta table',
          language: 'sql',
          code: "ALTER TABLE main.sales.orders SET TBLPROPERTIES (\n  'delta.columnMapping.mode' = 'name',\n  'delta.enableIcebergCompatV2' = 'true',\n  'delta.universalFormat.enabledFormats' = 'iceberg'\n);\n\n-- Tables with deletion vectors:\nREORG TABLE main.sales.orders\n  APPLY (UPGRADE UNIFORM (ICEBERG_COMPAT_VERSION = 2));",
          notes: ['Iceberg clients get read-only access to a UniForm table.'],
        },
      ],
    },
  ],
  related: [
    { slug: 'iceberg-support', title: 'Apache Iceberg interoperability' },
    { slug: 'file-format-ingestion', title: 'File format ingestion' },
  ],
};
