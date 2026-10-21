import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Snowflake or Trino needs to read our tables. Do I need a second copy as Iceberg?',
    answer:
      'No. Enable Iceberg reads on the Delta table and Iceberg clients get read-only access through the Unity Catalog Iceberg REST catalog, from one copy of the data. It needs column mapping and Unity Catalog.',
    links: [
      {
        label: 'Read Delta tables with Iceberg clients',
        url: 'https://docs.databricks.com/aws/en/delta/uniform',
      },
    ],
  },
  {
    question: 'When should I choose a managed Iceberg table instead?',
    answer:
      'Choose it when other engines must write to the table, or when Iceberg is your platform standard. Create it with SQL, because managed Iceberg tables reject Delta-style DataFrame writes. Liquid clustering on Iceberg is in Public Preview.',
    links: [{ label: 'What is Apache Iceberg in Databricks?', url: 'https://docs.databricks.com/aws/en/iceberg/' }],
  },
  {
    question: 'Should I query JSON and CSV files in place?',
    answer:
      'Use read_files for ad hoc queries and one-time loads, but ingest recurring files into a bronze Delta table with Auto Loader. JSON and CSV lose types and cannot skip data, so keep raw columns in bronze and cast types in silver.',
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
    question: 'Should I partition new tables?',
    answer:
      'No. Databricks recommends liquid clustering for all new tables. Use explicit CLUSTER BY keys when you know the filter columns and CLUSTER BY AUTO when you do not. Keep partitioning only for compatibility with outside tools.',
    links: [{ label: 'Liquid clustering', url: 'https://docs.databricks.com/aws/en/delta/clustering' }],
  },
  {
    question: 'Does CLUSTER BY AUTO have requirements?',
    answer:
      'Yes. It needs a Unity Catalog managed table with predictive optimization on. It runs asynchronously, and it may not choose keys for small tables.',
    links: [
      {
        label: 'Predictive optimization',
        url: 'https://docs.databricks.com/aws/en/optimizations/predictive-optimization',
      },
    ],
  },
  {
    question: 'How far back can time travel go?',
    answer:
      'Only as far as VACUUM allows. VACUUM removes data files older than the retention threshold, 7 days by default. Match retention to your recovery and audit needs, and keep it long enough for readers and streams.',
    links: [{ label: 'VACUUM', url: 'https://docs.databricks.com/aws/en/delta/vacuum' }],
  },
];
