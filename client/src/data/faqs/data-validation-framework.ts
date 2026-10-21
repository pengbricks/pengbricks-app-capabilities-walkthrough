import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Why not write the same validation twice, in the source and in Databricks, and compare the outputs?',
    answer:
      'The two versions diverge on rounding, null handling, time zones, and filters, and each mismatch costs an investigation that finds a bug in the checker instead of the data. Write each rule once in Databricks. The source answers small aggregate queries through Lakehouse Federation and holds no validation code.',
    links: [{ label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' }],
  },
  {
    question: 'Why do whole-table totals pass when data has still drifted?',
    answer:
      'Offsetting errors cancel out in a total, and a total cannot say where the drift is. Run whole-table totals on every load, and add per-day counts, sums, and a checksum on a schedule. Use row-level hashes only to investigate a slice that failed.',
    links: [
      {
        label: 'Run queries on a remote database with remote_query',
        url: 'https://docs.databricks.com/aws/en/query-federation/remote-queries',
      },
    ],
  },
  {
    question: 'Should a row rule warn, drop, or fail?',
    answer:
      'Drop plus a quarantine table for rules on data you can repair, warn while you tune a new rule, and fail only when one bad row makes the whole load meaningless. Drop alone loses the rows, so pair it with a quarantine table that records which rules each row broke.',
    links: [
      {
        label: 'Manage data quality with pipeline expectations',
        url: 'https://docs.databricks.com/aws/en/ldp/expectations',
      },
    ],
  },
  {
    question: 'Does a failed pipeline expectation stop downstream tables?',
    answer:
      'No. A pipeline dataset that fails does not stop other datasets from updating. To block downstream work, run the validation in its own pipeline or task and make the next task depend on it.',
    links: [{ label: 'Configure task dependencies and Run if', url: 'https://docs.databricks.com/aws/en/jobs/run-if' }],
  },
  {
    question: 'How is data quality monitoring different from the spec-driven checks?',
    answer:
      'Use both. Explicit checks in the spec cover deadlines you know and can block work. Anomaly detection learns the usual commit time and row count per table and flags what no rule anticipated, but it is Public Preview, needs history, and does not say which rule broke.',
    links: [
      {
        label: 'Data quality monitoring',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/',
      },
    ],
  },
  {
    question: 'Are Pages available for the business glossary?',
    answer:
      'Pages are Beta, and account admins control access from the Previews page. Confirm with the account team that they fit before you plan around them. Put metric definitions in metric views, and use comments, governed tags, and certification for the rest.',
    links: [{ label: 'Pages (Beta)', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' }],
  },
];
