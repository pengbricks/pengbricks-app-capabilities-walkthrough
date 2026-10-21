import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'create-catalog',
  area: 'Foundations',
  title: 'Create a catalog',
  intro:
    'Most guides and bundles here write to a catalog you already have. This page covers who can create one, where its data is stored, how to name catalogs per environment, and how to create one from Catalog Explorer, SQL, the CLI, or a bundle, then grant and check it.',
  businessValue: {
    summary:
      'A catalog is the unit Unity Catalog uses for environments and ownership. Creating dev, test, and prod catalogs up front keeps test data out of production and gives each team a place to build without waiting on a ticket.',
    outcomes: [
      {
        title: 'Dev cannot write to prod',
        body: 'Each environment has its own catalog, and workspace bindings decide which workspaces see it. A dev deploy points at dev_sales and never at prod_sales.',
      },
      {
        title: 'Storage is decided once',
        body: 'The managed location set on the catalog decides which bucket or container holds its tables. Cost reports and data residency follow the catalog.',
      },
      {
        title: 'Teams start the same day',
        body: 'With a catalog and one grant to a group, engineers create their own schemas, so new projects need no admin ticket per table.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'You need CREATE CATALOG.',
      body: 'Creating a catalog takes CREATE CATALOG on the metastore. If you lack it, ask a metastore or workspace admin to grant it or to create the catalog for you.',
    },
    {
      title: 'Storage comes from a managed location.',
      body: 'Without root storage on the metastore or default storage in the workspace, a catalog needs MANAGED LOCATION on an external location you hold CREATE MANAGED STORAGE on.',
    },
    {
      title: 'Name catalogs <environment>_<domain>.',
      body: 'dev_sales, test_sales, prod_sales. Bundles then set the catalog per target, and code never hardcodes one.',
    },
    {
      title: 'Bind and grant to groups.',
      body: 'Limit each catalog to the workspaces that should see it, make a group the owner, and grant USE CATALOG and CREATE SCHEMA to the groups that build in it.',
    },
    {
      title: 'Keep catalogs out of app bundles.',
      body: 'A bundle that creates its own catalog drops it on destroy. Create catalogs once, by an admin or a platform bundle, and let app bundles create only schemas.',
    },
  ],
  sections: [
    {
      id: 'who',
      heading: 'Who can create a catalog',
      table: {
        columns: ['To do this', 'You need'],
        rows: [
          ['Create a standard catalog', 'CREATE CATALOG on the metastore'],
          ['Give the catalog its own storage path', 'CREATE MANAGED STORAGE on the external location that holds the path'],
          ['Create a foreign catalog (Lakehouse Federation)', 'Ownership of the connection, or CREATE FOREIGN CATALOG on it'],
          ['Create a catalog from a Delta Sharing share', 'USE PROVIDER on the metastore, or ownership of the provider'],
          ['Create schemas in a catalog someone else made', 'USE CATALOG and CREATE SCHEMA on that catalog'],
        ],
      },
      examples: [
        {
          label: 'Check what you can do, or grant it as an admin',
          language: 'sql',
          code: `-- As yourself: which catalogs exist, and what you hold on one
SHOW CATALOGS;
SHOW GRANTS ON CATALOG dev_sales;

-- As a metastore admin: let a group create catalogs
GRANT CREATE CATALOG ON METASTORE TO \`data-platform\`;`,
          notes: ['If SHOW CATALOGS lists only main, samples, and system, ask an admin for a catalog or for CREATE CATALOG.'],
        },
      ],
      links: [
        { label: 'Create catalogs', url: 'https://docs.databricks.com/aws/en/catalogs/create-catalog' },
        { label: 'Unity Catalog privileges and securable objects', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/privileges' },
      ],
    },
    {
      id: 'storage',
      heading: 'Where the catalog stores data',
      prose:
        'Managed tables and volumes in a catalog store their files in a managed location. Unity Catalog uses the schema location if one is set, then the catalog location, then the metastore root storage or the workspace default storage. When none of these exists, CREATE CATALOG fails until you add MANAGED LOCATION.',
      options: {
        caption: 'Storage for a new catalog',
        rows: [
          {
            option: 'Inherit metastore root or default storage',
            when: 'A sandbox, a demo, or a workspace where one storage account for everything is acceptable.',
            tradeoffs:
              'Nothing to configure. Every catalog shares one storage path, so storage cost and data residency cannot be separated by catalog, and production data sits beside sandbox data.',
          },
          {
            option: 'MANAGED LOCATION per catalog',
            when: 'Environments or business units need their own bucket or container, for separate cost, retention, residency, or network rules.',
            tradeoffs:
              'Needs an external location and storage credential first, plus CREATE MANAGED STORAGE on it, which is admin work. Each catalog then bills and audits separately, and a dev mistake cannot touch prod files.',
          },
        ],
        recommendation:
          'Give production catalogs their own MANAGED LOCATION. Inherited storage is fine for dev and sandbox catalogs when the workspace has it.',
      },
      links: [
        { label: 'Managed storage locations', url: 'https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage' },
        { label: 'External locations', url: 'https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/external-locations' },
      ],
    },
    {
      id: 'naming',
      heading: 'Name catalogs per environment',
      prose:
        'The Unity Catalog best practices page recommends separating environments by catalog. Naming them <environment>_<domain> makes the environment readable in every three-level name, and bundle targets pick the catalog by name.',
      table: {
        columns: ['Catalog', 'Who uses it'],
        rows: [
          ['dev_sales', 'Engineers deploying in development mode; each gets a schema prefixed dev_<user>_'],
          ['test_sales', 'CI test runs, deployed by a service principal'],
          ['staging_sales', 'Release candidates against production-like data'],
          ['prod_sales', 'Production jobs and readers, deployed only from CI'],
          ['sandbox or main', 'Demos and quick experiments; a bundle demo target writes here verbatim'],
        ],
      },
      links: [
        { label: 'Unity Catalog best practices', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices' },
        { label: 'Limit catalog access to specific workspaces', url: 'https://docs.databricks.com/aws/en/catalogs/binding' },
      ],
    },
    {
      id: 'how',
      heading: 'Ways to create one',
      options: {
        caption: 'How to create the catalog',
        rows: [
          {
            option: 'Catalog Explorer',
            when: 'A one-time setup, or someone who prefers the UI.',
            tradeoffs:
              'Shows the type, storage, workspace access, and permissions as you go. Nothing records what you chose, so repeating it in another workspace is manual.',
          },
          {
            option: 'SQL or the CLI',
            when: 'Scripted setup, a setup notebook, or a runbook an admin follows.',
            tradeoffs:
              'Repeatable and reviewable. CREATE CATALOG IF NOT EXISTS is safe to rerun. Grants and bindings are separate statements you have to keep with it.',
          },
          {
            option: 'A catalog resource in a platform bundle',
            when: 'A platform team manages catalogs as code alongside grants, with the direct deployment engine (CLI 0.287.0 or later).',
            tradeoffs:
              'Catalogs, comments, and grants are versioned and reviewed in Git. bundle destroy drops the catalog, so keep it in a bundle that owns only platform objects, never in an application bundle. Terraform is the other common choice for this.',
          },
        ],
        recommendation:
          'Use SQL or Catalog Explorer for a first catalog. Once there are several environments, manage catalogs and their grants as code in a platform bundle or Terraform, separate from the bundles that deploy jobs and pipelines.',
      },
      links: [
        { label: 'Bundle resources: catalog', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources' },
        { label: 'CREATE CATALOG', url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-catalog' },
      ],
    },
    {
      id: 'try-it',
      heading: 'Create, grant, and check a catalog',
      steps: [
        {
          title: 'Create it in Catalog Explorer',
          body: 'Click Catalog in the sidebar, then the gear or + menu and Create catalog. Enter dev_sales, keep the type Standard, and choose a storage location if the form asks for one. Click Create, then on the next screen choose workspace access and permissions.',
        },
        {
          title: 'Or create it with SQL',
          body: 'Run on a SQL warehouse or serverless notebook. Add MANAGED LOCATION only when the metastore has no root storage and the workspace has no default storage, or when the catalog needs its own path.',
          code: `CREATE CATALOG IF NOT EXISTS dev_sales
  COMMENT 'Development catalog for the sales domain';

-- With its own storage path, inside an external location:
-- CREATE CATALOG IF NOT EXISTS prod_sales
--   MANAGED LOCATION 's3://<bucket>/prod_sales'
--   COMMENT 'Production catalog for the sales domain';`,
        },
        {
          title: 'Or create it with the CLI',
          body: 'The same call from a terminal, with the profile you signed in with.',
          code: `databricks catalogs create dev_sales --comment "Development catalog for the sales domain" --profile <name>
databricks catalogs get dev_sales --profile <name>`,
        },
        {
          title: 'Hand ownership to a group and grant builders',
          body: 'An owner who leaves the company leaves an orphaned catalog, so give it to a group. Builders need USE CATALOG and CREATE SCHEMA. Bundles that create schemas run as the deployer, so those people or the CI service principal need these grants.',
          code: `ALTER CATALOG dev_sales OWNER TO \`data-platform\`;
GRANT USE CATALOG, CREATE SCHEMA ON CATALOG dev_sales TO \`sales-engineers\`;
GRANT USE CATALOG ON CATALOG dev_sales TO \`sales-analysts\`;`,
        },
        {
          title: 'Limit which workspaces see it',
          body: 'A new catalog is shared with every workspace on the metastore. For prod_sales, clear All workspaces have access on the catalog Workspaces tab and assign only the production workspace.',
        },
        {
          title: 'Check it',
          body: 'Confirm the catalog, its grants, and that you can create a schema in it.',
          code: `DESCRIBE CATALOG EXTENDED dev_sales;
SHOW GRANTS ON CATALOG dev_sales;
CREATE SCHEMA IF NOT EXISTS dev_sales.smoke_test;
DROP SCHEMA dev_sales.smoke_test;`,
        },
      ],
    },
  ],
  related: [
    { slug: 'unity-catalog-basics', title: 'Unity Catalog basics' },
    { slug: 'environment-workspaces-catalogs', title: 'Workspaces and catalogs across dev, test, stage, and prod' },
    { slug: 'access-management', title: 'Access management' },
    { slug: 'vscode-databricks', title: 'Working with Databricks in VS Code' },
  ],
};
