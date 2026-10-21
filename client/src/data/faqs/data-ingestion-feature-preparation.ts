import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Why not join labels to features with a plain join on the key?',
    answer:
      'A plain join lets a label from last March see a feature value computed this week. That leaks the future and inflates offline accuracy. Declare a timestamp key on the feature table and a timestamp lookup key on the labels, and the training set takes the latest feature value at or before each label time.',
    links: [
      {
        label: 'Point-in-time feature joins',
        url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/time-series',
      },
    ],
  },
  {
    question: 'Why log the training set with the model?',
    answer:
      'Serving and batch scoring then look up the same features by key, and the model lineage in Unity Catalog names its feature tables and the source behind them.',
    links: [
      {
        label: 'Feature tables in Unity Catalog',
        url: 'https://docs.databricks.com/aws/en/machine-learning/feature-store/uc/feature-tables-uc',
      },
    ],
  },
  {
    question: 'Where should feature quality checks run?',
    answer:
      'Gate the write with pipeline expectations or assertions in the job, so a bad table never reaches a training set. Add data quality monitoring to watch drift after the table is live. Monitoring reports after the data lands and does not block a bad write, so use it next to a gate.',
    links: [{ label: 'Data quality monitoring', url: 'https://docs.databricks.com/aws/en/data-quality-monitoring/' }],
  },
  {
    question: 'How do I refresh a feature table without creating duplicates?',
    answer:
      'Recompute the changed entities on a schedule and write them with mode="merge". A merge on the primary key updates changed rows and adds new ones, so rerunning the same batch is safe.',
  },
  {
    question: 'Can I reproduce a training set months later with Delta time travel?',
    answer:
      'Not reliably. VACUUM deletes files older than delta.deletedFileRetentionDuration (7 days by default), and the log is trimmed after delta.logRetentionDuration. For audited or long-lived models, write the training set to its own table or DEEP CLONE the feature table at the version you used.',
    links: [{ label: 'Clone a table', url: 'https://docs.databricks.com/aws/en/delta/clone' }],
  },
  {
    question: 'Is a shallow clone enough to preserve a feature table version?',
    answer:
      'No. A shallow clone still depends on the source files, so it is not durable. A DEEP CLONE copies the data files and survives VACUUM on the source, at the cost of extra storage.',
  },
];
