import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'When should I use MERGE and when AUTO CDC?',
    answer:
      'Use MERGE for batch inserts, updates, and deletes, where you write the ordering and delete handling yourself. Use AUTO CDC for a continuous or ordered change feed, type 1 or type 2, because it handles sequencing, late data, deletes, and history. AUTO CDC fits only when the target is a pipeline-managed table.',
    links: [{ label: 'AUTO CDC in pipelines', url: 'https://docs.databricks.com/aws/en/ldp/cdc' }],
  },
  {
    question: 'Why did my MERGE fail with several source rows matching one target row?',
    answer:
      'The source has duplicate keys. Dedupe it first and keep the latest row per key, for example with QUALIFY ROW_NUMBER() OVER (PARTITION BY key ORDER BY change_ts DESC) = 1.',
    links: [{ label: 'Upsert into a Delta table with MERGE', url: 'https://docs.databricks.com/aws/en/delta/merge' }],
  },
  {
    question: 'How do I make MERGE faster on a large table?',
    answer:
      'Use liquid clustering on the merge key (CLUSTER BY AUTO if you are unsure), turn on deletion vectors, and leave maintenance to predictive optimization. Adding a predicate on the clustering or partition column to the ON clause, such as the last seven days, lets MERGE read only the files it needs.',
    links: [{ label: 'Liquid clustering', url: 'https://docs.databricks.com/aws/en/delta/clustering' }],
  },
  {
    question: 'Can I rerun a failed load safely?',
    answer:
      'Yes, if the load is repeatable. Key the MERGE on a stable business key, and a rerun of the same batch does not change the result. REPLACE WHERE also suits reruns because it rewrites the whole slice. A plain INSERT can create duplicates on a rerun.',
    links: [
      {
        label: 'Selective overwrite with REPLACE WHERE',
        url: 'https://docs.databricks.com/aws/en/delta/selective-overwrite',
      },
    ],
  },
  {
    question: 'How do I deliver large files to another team or a partner?',
    answer:
      'Write them with Spark to a Unity Catalog volume and share access with GRANT READ VOLUME. A pandas frame holds every row in driver memory, so use it only for small extracts. For partners outside the workspace, share the table with OpenSharing instead of copying files.',
    links: [{ label: 'Unity Catalog volumes', url: 'https://docs.databricks.com/aws/en/volumes/' }],
  },
  {
    question: 'How do I feed an application that needs low-latency reads?',
    answer: 'Sync the table to Lakebase Postgres instead of exporting files.',
    links: [{ label: 'Lakebase synced tables', url: 'https://docs.databricks.com/aws/en/oltp/projects/sync-tables' }],
  },
];
