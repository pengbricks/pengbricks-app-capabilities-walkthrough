import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Do I have to build all three layers?',
    answer:
      'No. A clean source can go straight to silver, and a small use case can read silver directly. The layers are a guide, not a rule.',
  },
  {
    question: 'Which expectation action should I start with?',
    answer:
      'Start with warn while you learn a source. Move key and contract rules to FAIL UPDATE, use a quarantine table where rejected rows have business value, and use DROP ROW only when discarding is safe. Dropped rows are counted but not stored, so you cannot repair them later.',
    links: [
      {
        label: 'Manage data quality with pipeline expectations',
        url: 'https://docs.databricks.com/aws/en/ldp/expectations',
      },
    ],
  },
  {
    question: 'Should gold be a view, a materialized view, or a metric view?',
    answer:
      'Use a materialized view for heavy aggregates that dashboards read often. Add a metric view on top when several tools need one definition of a measure. Use a plain view only for cheap logic that must be live, since every query reruns it.',
    links: [
      { label: 'Materialized views', url: 'https://docs.databricks.com/aws/en/ldp/materialized-views' },
      { label: 'Unity Catalog metric views', url: 'https://docs.databricks.com/aws/en/metric-views/' },
    ],
  },
  {
    question: 'How do I deduplicate in silver when the source sends updates?',
    answer:
      'Use AUTO CDC instead of a hand-written MERGE or ROW_NUMBER dedupe. It handles out-of-order events and deletes. The SCD and CDC guides cover the details.',
    links: [{ label: 'AUTO CDC', url: 'https://docs.databricks.com/aws/en/ldp/cdc' }],
  },
  {
    question: 'Can I fix bad data by editing bronze?',
    answer:
      'No. Bronze is the record of what the source sent. Fix the problem in the silver logic and rebuild, which works because bronze keeps the raw data.',
  },
  {
    question: 'How should I set up access across the layers?',
    answer:
      'Give each layer its own schema, such as sales_bronze, sales_silver, and sales_gold, with its own grants. Most users only need gold, and bronze stays with the engineers who run ingestion.',
    links: [{ label: 'Unity Catalog basics', url: '/walkthroughs/unity-catalog-basics' }],
  },
];
