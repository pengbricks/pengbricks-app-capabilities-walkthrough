import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should I convert my Delta tables to managed Iceberg?',
    answer:
      'Not if only Databricks writes. Keep the table Delta and turn on Iceberg reads so external Iceberg clients can query it. Choose managed Iceberg when Flink, open-source Spark, or another engine must write through the REST catalog, or when Iceberg is your platform standard.',
    links: [
      { label: 'Read Delta tables with Iceberg clients', url: 'https://docs.databricks.com/aws/en/delta/uniform' },
    ],
  },
  {
    question: 'What are the limits of Iceberg reads on a Delta table?',
    answer:
      'It needs column mapping on the Delta table. Deletion vectors cannot be enabled together with Iceberg reads on v2 compatibility, and external engines cannot read Unity Catalog views. Access is read-only for Iceberg clients.',
  },
  {
    question: 'What does an external engine need to read a Databricks table?',
    answer:
      'A metastore admin must enable external data access on the metastore. The reading principal needs SELECT on the table and EXTERNAL USE SCHEMA on its schema. Use a service principal with OAuth M2M, with a personal access token only as a fallback, and an Iceberg client at version 1.9.2 or above.',
    links: [
      {
        label: 'Access Databricks tables from Iceberg clients',
        url: 'https://docs.databricks.com/aws/en/external-access/iceberg',
      },
    ],
  },
  {
    question: 'Do external engines need storage keys?',
    answer:
      'No. With credential vending, Unity Catalog issues temporary credentials scoped to the table and the privilege, so a leaked token expires and cannot reach other storage.',
    links: [
      { label: 'Credential vending', url: 'https://docs.databricks.com/aws/en/external-access/credential-vending' },
    ],
  },
  {
    question: 'Which compute do managed Iceberg tables need, and what is required for v3?',
    answer:
      'Managed Iceberg tables need serverless compute with network access to the table storage, because Databricks uses it to maintain metadata. Iceberg v3 features need Databricks Runtime 18 LTS or above. Liquid clustering for managed Iceberg is in Public Preview.',
    links: [{ label: 'Use Apache Iceberg v3 features', url: 'https://docs.databricks.com/aws/en/iceberg/iceberg-v3' }],
  },
  {
    question: 'When do I use OpenSharing instead of the REST catalog?',
    answer:
      'Use OpenSharing for partners and other organizations where a share and recipient should control access. Use the REST catalog for engines you operate or trust that need live reads or writes. OpenSharing is read-only, and sharing managed and foreign Iceberg tables is generally available.',
    links: [{ label: 'OpenSharing', url: 'https://docs.databricks.com/aws/en/opensharing' }],
  },
];
