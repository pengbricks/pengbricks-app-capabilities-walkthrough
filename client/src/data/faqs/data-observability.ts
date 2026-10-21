import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Is lineage available immediately after a write?',
    answer:
      'No. Lineage events reach the system tables after a delay, so read them on a schedule instead of right after a write. Catalog Explorer shows the same data as a graph.',
    links: [{ label: 'Lineage system tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/lineage' }],
  },
  {
    question: 'Which data quality check should I turn on first?',
    answer:
      'Turn on anomaly detection for your schemas first, because it needs no per-table setup. Add data profiling to tables whose values drive decisions, and keep pipeline expectations for row-level rules inside pipelines. They catch different failures and work together.',
    links: [
      {
        label: 'Data quality monitoring',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/',
      },
    ],
  },
  {
    question: 'What does anomaly detection not cover?',
    answer:
      'Column values. It covers freshness and completeness only, and it needs history to learn from. It is also in Public Preview, so confirm its status before depending on it. Use data profiling when the values in specific tables matter.',
    links: [
      {
        label: 'Anomaly detection',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/anomaly-detection/',
      },
    ],
  },
  {
    question: 'What does data profiling need to detect drift?',
    answer:
      'A reference to compare against, either the previous time window or a baseline table of known-good data. You create and schedule a monitor per table, which uses compute. A cron schedule on the monitor refreshes its metrics tables, so do not recreate it to refresh.',
    links: [
      {
        label: 'Data profiling',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/',
      },
    ],
  },
  {
    question: 'How do I find out who changed a column?',
    answer:
      'Run DESCRIBE HISTORY on the table. Each schema change shows its operation, version, timestamp, and user. To watch many tables, snapshot information_schema.columns on a schedule and diff the snapshots.',
  },
  {
    question: 'Do pipeline expectations replace monitoring?',
    answer:
      'No. Expectations check each row at write time and can drop it or stop the update, but they cover only datasets in a pipeline. Monitors catch what the rules did not anticipate, including tables written elsewhere.',
    links: [
      {
        label: 'Manage data quality with pipeline expectations',
        url: 'https://docs.databricks.com/aws/en/ldp/expectations',
      },
    ],
  },
];
