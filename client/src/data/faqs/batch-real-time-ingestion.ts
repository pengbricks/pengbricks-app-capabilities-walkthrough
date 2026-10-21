import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which trigger mode should I start with?',
    answer:
      'Start with triggered. It starts compute, processes what is new, and stops, so it costs the least. Its latency is the schedule interval plus startup time, so move to continuous or real-time mode only when a business latency target requires it.',
    links: [
      { label: 'Triggered vs continuous pipeline mode', url: 'https://docs.databricks.com/aws/en/ldp/pipeline-mode' },
    ],
  },
  {
    question: 'Do I have to rewrite a pipeline to tighten its freshness later?',
    answer:
      'No. The same streaming table runs as scheduled batch or continuously, so a new latency requirement becomes a trigger setting change. Teams can start cheap and tighten later.',
  },
  {
    question: 'When does real-time mode make sense?',
    answer:
      'Use it for sub-second operational paths such as fraud checks or personalization. Most analytics does not need it. It has the highest compute cost because it needs enough task slots for every stage at once, and it supports a defined set of sources and sinks, so check the docs for the current release stage.',
    links: [
      {
        label: 'Real-time mode concepts',
        url: 'https://docs.databricks.com/aws/en/structured-streaming/real-time/concepts',
      },
    ],
  },
  {
    question: 'Should I use a streaming table, a materialized view, or a batch job?',
    answer:
      'Use a streaming table for append-only ingestion and a materialized view for transformations over bounded tables. Write a scheduled batch job only when the logic cannot be expressed declaratively, such as custom MERGE steps, because then you own the incremental logic, state, and tests.',
    links: [{ label: 'Materialized views', url: 'https://docs.databricks.com/aws/en/ldp/materialized-views' }],
  },
  {
    question: 'How do I backfill history into a streaming table?',
    answer:
      'Add an append flow that runs once (INSERT INTO ... ONCE in SQL, or once=True in Python). It runs next to the live flow without resetting its checkpoint. Do not delete a checkpoint to backfill, because you would reprocess everything or lose your position.',
    links: [
      {
        label: 'Backfill historical data with pipelines',
        url: 'https://docs.databricks.com/aws/en/ldp/flows-backfill',
      },
    ],
  },
  {
    question: 'Why would I turn off full refresh on a bronze table?',
    answer:
      'A full refresh clears the table and reprocesses the source. If the source files or topic retention no longer hold the full history, that data is lost. Set pipelines.reset.allowed to false on those bronze tables.',
  },
];
