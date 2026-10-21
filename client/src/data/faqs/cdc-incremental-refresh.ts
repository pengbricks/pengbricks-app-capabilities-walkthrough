import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which CDC source should I prefer?',
    answer:
      'Prefer a real change feed, from change files or a Delta change data feed, because the work follows the changes. Use snapshot CDC only when the source can produce nothing but full extracts, since each update compares the whole new snapshot with the previous one and cost follows table size.',
    links: [{ label: 'AUTO CDC in pipelines', url: 'https://docs.databricks.com/aws/en/ldp/cdc' }],
  },
  {
    question: 'What does a full refresh clear, and how do I protect raw tables?',
    answer:
      'It clears streaming tables and flow checkpoints, recomputes materialized views, and reprocesses only what the source still holds. Set pipelines.reset.allowed = false on tables you cannot rebuild, such as bronze, and a full refresh skips them.',
  },
  {
    question: 'Will Auto Loader reread a file I overwrite in place?',
    answer:
      'No. A file rewritten under a name it already processed is not read again, unless cloudFiles.allowOverwrites is on. Give each batch a new file name.',
    links: [
      {
        label: 'Auto Loader',
        url: 'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/',
      },
    ],
  },
  {
    question: 'What does the Delta change data feed source need?',
    answer:
      'The source needs the change data feed or row tracking enabled, and the feed covers only the history still retained. With row tracking on, Automatic change data feed works on serverless without delta.enableChangeDataFeed. Drop update_preimage rows before AUTO CDC.',
    links: [{ label: 'Change data feed', url: 'https://docs.databricks.com/aws/en/delta/delta-change-data-feed' }],
  },
  {
    question: 'Why run these pipelines on serverless?',
    answer:
      'Serverless is required for incremental materialized view refresh, and it removes autoscaling tuning. Compute then follows change volume instead of table size when the query supports incremental refresh. Check the planning_information event to see which technique each update used.',
  },
  {
    question: 'How do I stop bad change records from breaking ordering?',
    answer:
      'Put expectations on bronze. A null key or a null sequence value breaks ordering, so drop or fail those rows before AUTO CDC sees them. For databases, Lakeflow Connect gives managed CDC ingestion instead of a hand-built feed.',
  },
];
