import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'What privilege do I need to create a catalog?',
    answer:
      'CREATE CATALOG on the metastore. If you lack it, ask a metastore or workspace admin to grant it or to create the catalog for you. Giving the catalog its own storage path also takes CREATE MANAGED STORAGE on the external location that holds the path.',
    links: [{ label: 'Create catalogs', url: 'https://docs.databricks.com/aws/en/catalogs/create-catalog' }],
  },
  {
    question: 'Why does CREATE CATALOG fail asking for a managed location?',
    answer:
      'The metastore has no root storage and the workspace has no default storage, so Unity Catalog has nowhere to put managed tables and volumes. Add MANAGED LOCATION on an external location you hold CREATE MANAGED STORAGE on.',
    links: [
      {
        label: 'Managed storage locations',
        url: 'https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage',
      },
    ],
  },
  {
    question: 'Should every catalog get its own managed location?',
    answer:
      'Give production catalogs their own. A separate bucket or container lets each catalog bill and audit separately and keeps a dev mistake away from prod files. Inherited storage is fine for dev and sandbox catalogs, since every catalog on it shares one storage path.',
  },
  {
    question: 'Can an application bundle create the catalog?',
    answer:
      'It can, but it should not. A bundle that creates its own catalog drops it on destroy. Create catalogs once, through an admin or a platform bundle on the direct deployment engine (CLI 0.287.0 or later), and let app bundles create only schemas.',
    links: [
      { label: 'Bundle resources: catalog', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources' },
    ],
  },
  {
    question: 'Who can see a new catalog, and how do I restrict it?',
    answer:
      'A new catalog is shared with every workspace on the metastore. For a catalog like prod_sales, clear All workspaces have access on the Workspaces tab and assign only the production workspace.',
    links: [
      {
        label: 'Limit catalog access to specific workspaces',
        url: 'https://docs.databricks.com/aws/en/catalogs/binding',
      },
    ],
  },
  {
    question: 'Who should own the catalog?',
    answer:
      'A group. A catalog owned by a person who leaves the company is orphaned. Builders then need USE CATALOG and CREATE SCHEMA, and bundles that create schemas run as the deployer, so the deployer or the CI service principal needs those grants.',
  },
];
