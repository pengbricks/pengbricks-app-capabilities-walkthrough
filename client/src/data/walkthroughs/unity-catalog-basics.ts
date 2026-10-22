import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'unity-catalog-basics',
  area: 'Foundations',
  title: 'Unity Catalog basics',
  intro:
    'Unity Catalog is where every table, view, volume, function, and model gets its name, its owner, and its permissions. This page covers the object hierarchy, the three-level name, how a grant works, and where to find lineage.',
  businessValue: {
    summary:
      'Unity Catalog gives every table, file, and model one name, one owner, and one set of permissions. Security and compliance teams control access in one place instead of tool by tool.',
    outcomes: [
      {
        title: 'Audits become queries',
        body: "Unity Catalog records access in system.access tables, so an auditor's question about who touched a table becomes a query instead of a spreadsheet exercise.",
      },
      {
        title: 'Access follows group membership',
        body: 'Grants go to account-level groups. Onboarding or offboarding a person is one group change, not edits across every table they could read.',
      },
      {
        title: 'One policy covers many columns',
        body: "Attribute-based access control applies row filters and column masks by governed tag, so a single policy protects every column tagged as sensitive, in every team's schema.",
      },
      {
        title: 'Impact checks before changes',
        body: 'Lineage is captured automatically on Unity Catalog compute. Owners can see what depends on a table before they change it.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Three levels name everything.',
      body: 'Every object is catalog.schema.object, such as main.sales.orders. The same name works from SQL, Python, BI tools, and jobs.',
    },
    {
      title: 'Catalogs and schemas are folders for governance.',
      body: 'A catalog often maps to an environment or business unit; a schema groups related tables, views, and volumes.',
    },
    {
      title: 'Grants flow down.',
      body: 'SELECT on a schema covers every table in it. A reader also needs USE CATALOG and USE SCHEMA on the parents.',
    },
    {
      title: 'Grant to groups, not people.',
      body: 'Add people to account-level groups and grant the group. Access changes become group membership changes.',
    },
    {
      title: 'Manage tables and volumes in Unity Catalog.',
      body: 'Prefer managed tables and managed volumes. Use external ones only when another system owns the files. Replace DBFS mounts and hive_metastore with volumes and Unity Catalog tables.',
    },
    {
      title: 'Own with groups, grant the least.',
      body: 'Make a group or service principal the owner of shared objects, not a person. Grant the narrowest privilege that works and avoid ALL PRIVILEGES.',
    },
    {
      title: 'Scale policy with tags.',
      body: 'Attribute-based access control (ABAC) applies row filters and column masks by governed tag, so one policy covers every tagged column.',
    },
    {
      title: 'Lineage and audit are built in.',
      body: 'On Unity Catalog compute, lineage and audit are recorded automatically and exposed through Catalog Explorer and the system.access tables.',
    },
  ],
  sections: [
    {
      id: 'hierarchy',
      heading: 'The object hierarchy',
      prose:
        'One metastore per cloud region holds the catalogs for every workspace attached to it. Workspaces see the same catalogs, so a table created in one is visible in another when permissions allow.',
      diagram: {
        type: 'flow',
        title: 'From metastore to objects',
        description:
          'A metastore contains catalogs, such as dev and prod. Each catalog contains schemas, such as sales. A schema contains tables, views, and volumes for files, as well as functions and registered models. The full name of the orders table is prod.sales.orders.',
        lanes: [
          { label: 'Metastore', fromRow: 0, toRow: 0 },
          { label: 'Catalog', fromRow: 1, toRow: 1 },
          { label: 'Schema', fromRow: 2, toRow: 2 },
          { label: 'Objects', fromRow: 3, toRow: 3 },
        ],
        nodes: [
          {
            id: 'metastore',
            label: 'Metastore',
            sub: 'one per region',
            col: 1,
            row: 0,
            kind: 'highlight',
            domain: 'governance',
            detail:
              'The top container, one per cloud region. Every attached workspace sees the same catalogs, so a table created in one is visible in another when permissions allow.',
          },
          {
            id: 'dev',
            label: 'dev',
            mono: true,
            col: 0,
            row: 1,
            domain: 'governance',
            detail:
              'A catalog often maps to an environment or business unit. Catalogs are the first level of the three-level name.',
          },
          {
            id: 'prod',
            label: 'prod',
            mono: true,
            col: 1,
            row: 1,
            domain: 'governance',
            detail: 'The catalog in the full name prod.sales.orders. A reader needs USE CATALOG on it.',
          },
          {
            id: 'sales',
            label: 'sales',
            mono: true,
            col: 1,
            row: 2,
            icon: 'data-model',
            domain: 'governance',
            detail:
              'A schema groups related tables, views, and volumes. A reader needs USE SCHEMA here, and SELECT on the schema covers every table in it.',
          },
          {
            id: 'table',
            label: 'orders',
            mono: true,
            sub: 'table',
            col: 0,
            row: 3,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Rows and columns in Delta or Iceberg. Managed tables let Unity Catalog own the files. The full name is prod.sales.orders.',
          },
          {
            id: 'view',
            label: 'orders_by_day',
            mono: true,
            sub: 'view',
            col: 1,
            row: 3,
            domain: 'data',
            detail: 'A saved query over tables, used to rename, filter, or join without copying data.',
          },
          {
            id: 'volume',
            label: 'landing',
            mono: true,
            sub: 'volume (files)',
            col: 2,
            row: 3,
            kind: 'store',
            icon: 'data-file',
            domain: 'data',
            detail: 'Files of any type, such as CSV drops, PDFs, or images, at /Volumes/catalog/schema/volume.',
          },
        ],
        edges: [
          { from: 'metastore', to: 'dev' },
          { from: 'metastore', to: 'prod' },
          { from: 'prod', to: 'sales' },
          { from: 'sales', to: 'table' },
          { from: 'sales', to: 'view' },
          { from: 'sales', to: 'volume' },
        ],
        legend: [
          { kind: 'highlight', label: 'Shared by attached workspaces' },
          { kind: 'store', label: 'Holds data' },
        ],
        caption: 'Full name of the table: prod.sales.orders',
      },
    },
    {
      id: 'objects',
      heading: 'What lives in a schema',
      table: {
        columns: ['Object', 'What it is for'],
        rows: [
          ['Table', 'Rows and columns in Delta or Iceberg. Managed tables let Unity Catalog own the files.'],
          ['View', 'A saved query over tables, used to rename, filter, or join without copying data.'],
          ['Volume', 'Files of any type, such as CSV drops, PDFs, or images, at /Volumes/catalog/schema/volume.'],
          ['Function', 'A SQL or Python function you can call in queries or give to an agent as a tool.'],
          ['Model', 'An MLflow model with versions and aliases, served or used in batch scoring.'],
        ],
      },
    },
    {
      id: 'grants',
      heading: 'How a grant works',
      prose:
        'Access needs a path. To read prod.sales.orders a group needs USE CATALOG on prod, USE SCHEMA on sales, and SELECT on the table or the schema. Missing any one denies the read.',
      diagram: {
        type: 'matrix',
        title: 'Privileges a reader needs',
        description:
          'An analyst group with USE CATALOG on prod, USE SCHEMA on prod.sales, and SELECT on prod.sales can read every table in the schema. Without USE SCHEMA the same SELECT grant does nothing. An engineering group with MODIFY and CREATE TABLE on the schema can also write.',
        corner: 'Group ↓ · Object →',
        columns: ['prod', 'prod.sales', 'Tables in sales'],
        rows: [
          {
            label: 'analysts',
            sub: 'read only',
            cells: [
              {
                state: 'own',
                text: 'USE CATALOG',
                detail: 'Without USE CATALOG on the parent, the read is denied even when the table grant exists.',
              },
              {
                state: 'own',
                text: 'USE SCHEMA',
                sub: 'SELECT',
                detail:
                  'Without USE SCHEMA the same SELECT grant does nothing. SELECT on the schema covers every table in it.',
              },
              {
                state: 'own',
                text: 'Read',
                sub: 'inherited',
                detail:
                  'Tables inherit the SELECT granted on the schema, so new tables are covered without another grant.',
              },
            ],
          },
          {
            label: 'engineers',
            sub: 'read and write',
            cells: [
              { state: 'own', text: 'USE CATALOG' },
              {
                state: 'own',
                text: 'USE SCHEMA',
                sub: 'MODIFY, CREATE TABLE',
                detail: 'MODIFY and CREATE TABLE on the schema let engineers write as well as read.',
              },
              { state: 'own', text: 'Read, write', sub: 'inherited' },
            ],
          },
          {
            label: 'everyone else',
            sub: 'no grants',
            cells: [
              { state: 'none', text: 'No access' },
              { state: 'none', text: 'Not visible' },
              {
                state: 'none',
                text: 'Denied',
                detail:
                  'With no grants on the catalog or schema, the read is denied. Missing any one privilege in the path denies it.',
              },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Granted or inherited' },
          { state: 'none', label: 'No privilege' },
        ],
      },
      examples: [
        {
          label: 'Give a group read access to a schema',
          language: 'sql',
          code: `GRANT USE CATALOG ON CATALOG prod TO \`analysts\`;
GRANT USE SCHEMA, SELECT ON SCHEMA prod.sales TO \`analysts\`;
SHOW GRANTS \`analysts\` ON SCHEMA prod.sales;`,
          notes: ['Grant on the schema so new tables are covered without another grant.'],
        },
      ],
    },
    {
      id: 'practices',
      heading: 'Practices that scale',
      points: [
        {
          strong: 'Catalog per environment, bound to workspaces.',
          text: 'Use dev, staging, and prod catalogs and bind each to the workspaces that should see it (workspace bindings). Production data then cannot be read from a dev workspace, even by users with a grant.',
        },
        {
          strong: 'Managed over external.',
          text: 'Managed tables and volumes get predictive optimization, lifecycle handling, and one governed storage path. Create external tables and volumes through an external location and storage credential only when files must stay where they are.',
        },
        {
          strong: 'Volumes, not DBFS mounts or hive_metastore.',
          text: 'Volumes give governed path access to files at /Volumes/catalog/schema/volume. Migrate legacy hive_metastore tables with the Unity Catalog upgrade tooling (SYNC, or UCX for larger estates).',
        },
        {
          strong: 'Own with groups or service principals.',
          text: 'An object owned by a departed employee becomes an orphan. Make an account group or service principal the owner, and run pipelines and jobs as a service principal.',
        },
        {
          strong: 'Least privilege.',
          text: 'Grant SELECT to readers and MODIFY only to writers. Reserve MANAGE and ALL PRIVILEGES for owners. Grant at the schema level so new tables inherit access.',
        },
        {
          strong: 'ABAC with governed tags.',
          text: 'Tag columns (for example class = pii) with governed tags and write one policy that masks or filters by tag, instead of a mask function on every column. See the row and column security guide.',
        },
        {
          strong: 'Audit with system tables.',
          text: 'system.access.audit records who did what, system.access.table_lineage and column_lineage record data flow, and system.billing.usage records spend. Query them with SQL or build dashboards.',
        },
      ],
      options: {
        caption: 'Managed or external tables',
        rows: [
          {
            option: 'Managed table',
            when: 'Databricks is the main reader and writer, and nothing else needs to own the storage path.',
            tradeoffs:
              'Unity Catalog manages storage, layout, and optimization. The docs say managed tables cost less to store and query and stay open to outside clients through the Iceberg REST catalog. Features such as predictive optimization and multi-statement transactions are not available on external tables. Files sit in the schema or catalog managed location, so plan those locations up front.',
          },
          {
            option: 'External table',
            when: 'Another system must own the files, the data format is not Delta or Iceberg (JSON, Avro, CSV, Parquet, ORC, text), or a non-Databricks client needs direct path access.',
            tradeoffs:
              'Files stay where they are and dropping the table keeps the data. Unity Catalog manages metadata only, not lifecycle, layout, or optimization, so you own compaction and cleanup. Unity Catalog privileges are not enforced when someone reads the files directly, and metadata changed outside Databricks can drift until you run a repair.',
          },
        ],
        recommendation:
          'Default to managed tables. Choose external only when another system must own the storage path or the files are in a format managed tables do not cover. You can convert an external Delta table to managed later.',
      },
      links: [
        { label: 'Unity Catalog managed tables', url: 'https://docs.databricks.com/aws/en/tables/managed' },
        { label: 'External tables', url: 'https://docs.databricks.com/aws/en/tables/external' },
        {
          label: 'Unity Catalog best practices',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices',
        },
        {
          label: 'Limit catalog access to specific workspaces',
          url: 'https://docs.databricks.com/aws/en/catalogs/binding',
        },
        { label: 'System tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' },
      ],
    },
    {
      id: 'try-it',
      heading: 'Try it',
      steps: [
        {
          title: 'Create a catalog and schema',
          body: 'CREATE CATALOG without a managed location works only when the workspace has default storage or the metastore has a root storage location. Otherwise add MANAGED LOCATION, or ask an admin for a catalog.',
          code: 'CREATE CATALOG IF NOT EXISTS sandbox;\nCREATE SCHEMA IF NOT EXISTS sandbox.getting_started;',
        },
        {
          title: 'Create a table and a volume',
          body: 'The table copies a sample dataset; the volume holds files you upload.',
          code: 'CREATE OR REPLACE TABLE sandbox.getting_started.trips AS\nSELECT * FROM samples.nyctaxi.trips;\nCREATE VOLUME IF NOT EXISTS sandbox.getting_started.uploads;',
        },
        {
          title: 'Query by its full name',
          body: 'The three-level name works from any workspace attached to the metastore.',
          code: 'SELECT count(*) FROM sandbox.getting_started.trips;',
        },
        {
          title: 'Find it in Catalog Explorer',
          body: 'Open Catalog, browse to the table, and check the Overview, Permissions, and Lineage tabs. Lineage shows samples.nyctaxi.trips as the source.',
        },
      ],
    },
  ],
  related: [
    { slug: 'how-databricks-works', title: 'How Databricks works' },
    { slug: 'medallion-architecture', title: 'Medallion architecture' },
    { slug: 'access-management', title: 'Access management' },
    { slug: 'row-column-security', title: 'Row and column security' },
  ],
};
