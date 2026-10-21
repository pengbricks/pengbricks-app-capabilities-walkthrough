import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Does stopping compute delete my data?',
    answer:
      'No. Tables are Delta or Iceberg files in your own ADLS, S3, or GCS account, so stopping or replacing compute deletes nothing. You can run DESCRIBE DETAIL again after a warehouse restarts and see the same files.',
  },
  {
    question: 'When should I use classic compute instead of serverless?',
    answer:
      'Start on serverless, and move a single workload to classic only when it needs R, Spark RDD APIs, Maven libraries, a specific instance type or GPU, or a network path your own VPC controls. Classic gives full control over runtime and libraries, but you size the cluster and set auto-termination yourself.',
    links: [
      {
        label: 'Serverless compute limitations',
        url: 'https://docs.databricks.com/aws/en/compute/serverless/limitations',
      },
    ],
  },
  {
    question: 'Who pays for what: storage, compute, or both?',
    answer:
      'Both are billed separately. Compute is billed in DBUs only while it runs, and the cloud provider bills storage. Idle serverless workloads cost no compute.',
  },
  {
    question: 'How do we charge costs back to teams?',
    answer:
      'Apply serverless usage policies so serverless usage carries a tag, add custom tags to classic compute and warehouses, then query system.billing.usage by those tags. Set the tags from the first workload.',
    links: [
      { label: 'Serverless usage policies', url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies' },
      { label: 'Billable usage system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing' },
    ],
  },
  {
    question: 'Should I use managed or external tables?',
    answer:
      'Default to Unity Catalog managed tables. They get predictive optimization, which runs OPTIMIZE, VACUUM, and ANALYZE for you, plus liquid clustering in place of manual partitioning. Use external tables only when another system must own the files.',
    links: [
      {
        label: 'Predictive optimization',
        url: 'https://docs.databricks.com/aws/en/optimizations/predictive-optimization',
      },
    ],
  },
  {
    question: 'Where does my data get processed?',
    answer:
      'The control plane hosts the web UI, job scheduler, and Unity Catalog. Your data is processed on the compute plane, which is serverless compute managed by Databricks or classic clusters in your own cloud account.',
  },
];
