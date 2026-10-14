import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'iceberg-support',
  area: 'General Guides',
  title: 'Apache Iceberg interoperability',
  intro:
    'One Unity Catalog table is written and evolved in Databricks, then read from PyIceberg through the Iceberg REST catalog. The external client uses an OAuth token and vended storage credentials, so it holds no storage keys. Every step writes a row to the iceberg_checks table.',
  shortVersion: [
    {
      title: 'A managed Iceberg table is one statement.',
      body: 'CREATE TABLE ... USING ICEBERG creates orders_iceberg with 1,000 rows. A second write appends 500.',
    },
    {
      title: 'The schema evolves in place.',
      body: 'ALTER TABLE ADD COLUMN channel adds an eighth column. Existing rows are backfilled with online.',
    },
    {
      title: 'Time travel reads the older shape.',
      body: 'VERSION AS OF 1 returns 1,500 rows with seven columns, before channel existed.',
    },
    {
      title: 'The external read uses the REST catalog.',
      body: 'PyIceberg sees all eight columns, reads 1,500 rows that match Spark, and filters region = West to 417 rows.',
    },
    {
      title: 'Two settings make it work.',
      body: 'External data access is on for the metastore, and the reading identity has EXTERNAL USE SCHEMA on the schema.',
    },
  ],
  sections: [
    {
      id: 'flow',
      heading: 'Write in Databricks, read anywhere',
      prose:
        'The first task works through Spark SQL. The second task runs PyIceberg in the same job but talks only to the REST catalog and cloud storage, the way an external engine would.',
      diagram: {
        type: 'flow',
        title: 'From a managed Iceberg table to an external read',
        description:
          'Task managed_iceberg_table creates orders_iceberg with USING ICEBERG, appends rows, adds the channel column, reads VERSION AS OF 1, and grants EXTERNAL USE SCHEMA. Task read_through_irc asks the Unity Catalog Iceberg REST catalog for the table with an OAuth bearer token. The catalog returns table metadata and vended storage credentials. PyIceberg reads the data files from cloud storage. Both tasks write rows to iceberg_checks.',
        lanes: [
          { label: 'Databricks, Spark SQL', fromRow: 0, toRow: 0 },
          { label: 'External client, PyIceberg', fromRow: 1, toRow: 2 },
        ],
        nodes: [
          { id: 'create', label: 'CREATE ... ICEBERG', sub: 'managed table', col: 0, row: 0 },
          { id: 'table', label: 'orders_iceberg', mono: true, sub: 'Unity Catalog', col: 1, row: 0, kind: 'store' },
          { id: 'evolve', label: 'ADD COLUMN, UPDATE', sub: 'schema evolution', col: 2, row: 0 },
          { id: 'travel', label: 'VERSION AS OF 1', sub: 'time travel', col: 3, row: 0 },
          { id: 'client', label: 'PyIceberg', sub: 'OAuth bearer token', col: 0, row: 1, kind: 'highlight' },
          { id: 'irc', label: 'Iceberg REST catalog', sub: 'metadata + credentials', col: 1, row: 1, kind: 'surface' },
          { id: 'storage', label: 'Cloud storage', sub: 'data files', col: 2, row: 1, kind: 'store' },
          { id: 'checks', label: 'iceberg_checks', mono: true, sub: 'one row per check', col: 1, row: 2, kind: 'store' },
        ],
        edges: [
          { from: 'create', to: 'table' },
          { from: 'table', to: 'evolve' },
          { from: 'evolve', to: 'travel' },
          { from: 'table', to: 'irc', label: 'exposed through' },
          { from: 'client', to: 'irc', label: 'load_table' },
          { from: 'client', to: 'storage', label: 'vended credentials', dashed: true },
          { from: 'client', to: 'checks' },
        ],
        legend: [
          { kind: 'highlight', label: 'External engine' },
          { kind: 'surface', label: 'Unity Catalog endpoint' },
          { kind: 'dashed', label: 'Temporary storage credentials' },
        ],
      },
    },
    {
      id: 'versions',
      heading: 'Versions and what each one shows',
      prose: 'DESCRIBE HISTORY lists four versions. Reading version 1 gives the table as it was before the column was added.',
      diagram: {
        type: 'matrix',
        title: 'Table shape by version',
        description:
          'Version 0 is CREATE TABLE AS SELECT with 1,000 rows and seven columns. Version 1 is a write that brings the table to 1,500 rows and seven columns. Version 2 adds the channel column, making eight columns. Version 3 updates rows to backfill channel.',
        corner: 'Version ↓ · Shape →',
        columns: ['Operation', 'Columns'],
        rows: [
          {
            label: 'Version 0',
            sub: '1,000 rows',
            cells: [
              { state: 'own', text: 'CREATE TABLE AS SELECT' },
              { state: 'own', text: '7' },
            ],
          },
          {
            label: 'Version 1',
            sub: '1,500 rows',
            cells: [
              { state: 'own', text: 'WRITE (append)' },
              { state: 'own', text: '7' },
            ],
          },
          {
            label: 'Version 2',
            sub: '1,500 rows',
            cells: [
              { state: 'own', text: 'ADD COLUMNS' },
              { state: 'optional', text: '8, channel is NULL' },
            ],
          },
          {
            label: 'Version 3',
            sub: '1,500 rows',
            cells: [
              { state: 'own', text: 'UPDATE (backfill)' },
              { state: 'optional', text: '8, channel = online' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Original seven columns' },
          { state: 'optional', label: 'Includes the added column' },
        ],
        caption: 'The time-travel check reads version 1 and confirms it has no channel column.',
      },
    },
    {
      id: 'external',
      heading: 'Reading through the REST catalog',
      prose:
        'The REST catalog lives on the workspace host. PyIceberg needs four properties; the token is the OAuth token of the job identity.',
      steps: [
        {
          title: 'Configure the catalog',
          body: 'The warehouse property is the Unity Catalog catalog name. The header asks for vended credentials so PyIceberg can read the data files.',
          code: 'load_catalog("unity", type="rest",\n  uri="https://<host>/api/2.1/unity-catalog/iceberg-rest",\n  warehouse="<catalog>", token=token,\n  **{"header.X-Iceberg-Access-Delegation": "vended-credentials"})',
        },
        {
          title: 'Load and scan',
          body: 'load_table("<schema>.orders_iceberg") returns the current schema with channel. A full scan returns 1,500 rows, equal to the Spark count.',
        },
        {
          title: 'Filter at the client',
          body: 'EqualTo("region", "West") returns 417 rows. The filter is pushed into the Iceberg scan plan.',
        },
      ],
    },
    {
      id: 'access',
      heading: 'What external access depends on',
      prose: 'Two Unity Catalog controls gate the external read. The job grants the second one itself.',
      points: [
        {
          strong: 'Metastore setting.',
          text: 'External data access must be enabled on the metastore. An admin sets it; the workspace used here already had it on.',
        },
        {
          strong: 'Schema privilege.',
          text: 'The job runs GRANT EXTERNAL USE SCHEMA on the guide schema to the identity PyIceberg uses, along with ordinary SELECT.',
        },
        {
          strong: 'Other identities.',
          text: 'A service principal with an OAuth secret, or a personal access token, gives an outside client the same bearer token.',
        },
      ],
    },
  ],
  related: [
    { slug: 'external-integrations', title: 'Partner tool integrations' },
    { slug: 'data-sharing', title: 'Governed data sharing' },
  ],
};
