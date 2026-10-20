import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'unity-catalog-basics',
  area: 'Foundations',
  title: 'Unity Catalog basics',
  intro:
    'Unity Catalog is where every table, view, volume, function, and model gets its name, its owner, and its permissions. This page covers the object hierarchy, the three-level name, how a grant works, and where to find lineage.',
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
          { id: 'metastore', label: 'Metastore', sub: 'one per region', col: 1, row: 0, kind: 'highlight' },
          { id: 'dev', label: 'dev', mono: true, col: 0, row: 1 },
          { id: 'prod', label: 'prod', mono: true, col: 1, row: 1 },
          { id: 'sales', label: 'sales', mono: true, col: 1, row: 2 },
          { id: 'table', label: 'orders', mono: true, sub: 'table', col: 0, row: 3, kind: 'store' },
          { id: 'view', label: 'orders_by_day', mono: true, sub: 'view', col: 1, row: 3 },
          { id: 'volume', label: 'landing', mono: true, sub: 'volume (files)', col: 2, row: 3, kind: 'store' },
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
              { state: 'own', text: 'USE CATALOG' },
              { state: 'own', text: 'USE SCHEMA', sub: 'SELECT' },
              { state: 'own', text: 'Read', sub: 'inherited' },
            ],
          },
          {
            label: 'engineers',
            sub: 'read and write',
            cells: [
              { state: 'own', text: 'USE CATALOG' },
              { state: 'own', text: 'USE SCHEMA', sub: 'MODIFY, CREATE TABLE' },
              { state: 'own', text: 'Read, write', sub: 'inherited' },
            ],
          },
          {
            label: 'everyone else',
            sub: 'no grants',
            cells: [
              { state: 'none', text: 'No access' },
              { state: 'none', text: 'Not visible' },
              { state: 'none', text: 'Denied' },
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
      links: [
        { label: 'Unity Catalog best practices', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices' },
        { label: 'Limit catalog access to specific workspaces', url: 'https://docs.databricks.com/aws/en/catalogs/binding' },
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
