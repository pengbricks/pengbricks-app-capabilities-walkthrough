import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which converter should I run?',
    answer:
      'Run BladeBridge for bulk SQL and ETL conversion, and the agentic code converter in Genie Code for interactive, validated SQL conversion. Use Switch for code the others cannot handle, and plan more review time for it because LLM output can vary between runs.',
    links: [
      { label: 'Lakebridge transpile', url: 'https://databrickslabs.github.io/lakebridge/docs/transpile/' },
      {
        label: 'Convert SQL with the agentic code converter',
        url: 'https://docs.databricks.com/aws/en/migration/agentic-code-converter',
      },
    ],
  },
  {
    question: 'Is the agentic code converter generally available?',
    answer:
      'Yes for SQL conversion, covering T-SQL, Snowflake, Redshift, Oracle, BigQuery, and Teradata. Its Notebooks target is Beta. Check the docs for size limits before pointing it at a very large estate.',
  },
  {
    question: 'Will the converter handle everything?',
    answer:
      'No. Automatic conversion handles the bulk of ordinary SQL, but cursors, loops, dynamic SQL, and vendor features have no direct equivalent. Sort converted statements into clean, needs-review, and manual, and spend human time on the last two.',
  },
  {
    question: 'How do I prove the migrated results are right?',
    answer:
      "Run Lakebridge Reconcile against the legacy system's own output on the same input snapshot. A reference you wrote yourself only proves the conversion matches that reference. Keep reconciling every cycle through the parallel run.",
    links: [{ label: 'Lakebridge Reconcile', url: 'https://databrickslabs.github.io/lakebridge/docs/reconcile/' }],
  },
  {
    question: 'Which Reconcile report type should I use?',
    answer:
      'Run schema reports early and often, data reports on keyed tables through the parallel run, and row reports where no key exists. Use all for sign-off on critical tables, since it costs the most compute.',
  },
  {
    question: 'When can we turn off the legacy system?',
    answer:
      'After reconciliation passes over a full business cycle, including month-end if it matters, and after cutover with a rehearsed rollback. Remove legacy access only after the agreed retention period, with archives in place.',
  },
];
