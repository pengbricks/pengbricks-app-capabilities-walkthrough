import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should I use a for_each task or generate pipeline definitions from config?',
    answer:
      'Use a for_each task when sources are independent units of work, and a generated pipeline when the outputs feed one another and you want one dependency graph. A for_each task gives each source its own retries, run history, and repair run. Write a custom runner loop only when neither fits.',
    links: [
      {
        label: 'Run a parameterized job task in a loop (for_each)',
        url: 'https://docs.databricks.com/aws/en/jobs/for-each',
      },
    ],
  },
  {
    question: 'Where should the configuration live, Git or a Unity Catalog table?',
    answer:
      'Git by default, because changes need review, a diff, and a controlled deploy. Use a Unity Catalog table when data owners edit settings often and a change should apply on the next run without a deploy. You then add validation, an audit trail, and a way to promote values between dev and prod yourself.',
  },
  {
    question: 'Do I need to write my own validation and upsert code?',
    answer:
      'Usually no. Pipeline expectations cover row-level quality rules, and AUTO CDC handles upserts, deduplication, and out-of-order data with a key, a sequence column, and SCD type 1 or 2. Write a custom validator only when you must store the failed rule names per row. Write MERGE yourself only for logic beyond key and sequence.',
    links: [{ label: 'AUTO CDC', url: 'https://docs.databricks.com/aws/en/ldp/cdc' }],
  },
  {
    question: 'What do I do when one source needs special code?',
    answer:
      'Put it behind a small adapter. The adapter reads the landed data and returns a DataFrame in the canonical schema, and you register it by name in the config. Shared code never branches on the source name. If a config option needs an if-statement in shared code, it is a new adapter.',
  },
  {
    question: 'What happens to rows that fail a rule?',
    answer:
      'They go to a quarantine table with the names of the rules they failed, so someone can repair and replay them. Rows that pass are merged into the target. Alert on the reject rate rather than on individual rows.',
  },
  {
    question: 'How do I audit who changed or ran an ingestion job?',
    answer:
      'Query system tables. system.access.audit records create, edit, run, and permission changes for jobs and pipelines, and system.lakeflow.job_run_timeline and system.lakeflow.pipeline_update_timeline show every run and its result. The framework also writes its own audit row per run.',
  },
];
