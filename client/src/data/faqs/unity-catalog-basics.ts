import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Why does a SELECT grant not let my group read the table?',
    answer:
      'The group also needs USE CATALOG on the catalog and USE SCHEMA on the schema. Missing any one of the three denies the read. Granting SELECT on the schema covers every table in it, including new ones.',
  },
  {
    question: 'Should I use managed or external tables?',
    answer:
      'Default to managed tables. Choose external only when another system must own the files or the format is not Delta or Iceberg. External tables do not get predictive optimization or multi-statement transactions, and Unity Catalog privileges are not enforced when someone reads the files directly.',
    links: [
      { label: 'Unity Catalog managed tables', url: 'https://docs.databricks.com/aws/en/tables/managed' },
      { label: 'External tables', url: 'https://docs.databricks.com/aws/en/tables/external' },
    ],
  },
  {
    question: 'How do I keep production data out of a dev workspace?',
    answer:
      'Create separate dev, staging, and prod catalogs and bind each one to the workspaces that should see it. With a workspace binding, users in a dev workspace cannot read production data even when they hold a grant.',
    links: [
      {
        label: 'Limit catalog access to specific workspaces',
        url: 'https://docs.databricks.com/aws/en/catalogs/binding',
      },
    ],
  },
  {
    question: 'Who should own shared objects?',
    answer:
      'An account group or a service principal, not a person. An object owned by a departed employee becomes an orphan. Run pipelines and jobs as a service principal for the same reason.',
  },
  {
    question: 'How do I find out who accessed a table or what depends on it?',
    answer:
      'Query the system tables. system.access.audit records who did what, and system.access.table_lineage and column_lineage record data flow. Lineage is captured automatically on Unity Catalog compute and also appears in Catalog Explorer.',
    links: [{ label: 'System tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' }],
  },
  {
    question: 'How do I move off hive_metastore and DBFS mounts?',
    answer:
      'Replace DBFS mounts with volumes and hive_metastore tables with Unity Catalog tables. Migrate legacy tables with the Unity Catalog upgrade tooling, using SYNC or UCX for larger estates.',
  },
];
