import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which dataset type should I use for ingest, silver, and gold?',
    answer:
      'Use streaming tables for ingest, AUTO CDC for change feeds, and materialized views for the silver and gold data people query. Use a view only for intermediate logic. A view stores nothing and reruns every time a downstream dataset reads it, so keep it for light steps.',
    links: [{ label: 'Streaming tables', url: 'https://docs.databricks.com/aws/en/ldp/streaming-tables' }],
  },
  {
    question: 'Will a materialized view always refresh incrementally?',
    answer:
      'No. Incremental refresh needs a serverless pipeline and a query that supports it, and the refresh falls back to a full recompute when it does not. Run EXPLAIN CREATE MATERIALIZED VIEW to see whether the query can refresh incrementally and why not if it cannot. Row tracking on the source tables makes more query shapes eligible.',
    links: [
      {
        label: 'Incremental refresh for materialized views',
        url: 'https://docs.databricks.com/aws/en/optimizations/incremental-refresh',
      },
    ],
  },
  {
    question: 'When should I run a full refresh?',
    answer:
      'Run one on purpose after you change logic, fix bad history, or backfill. Do not set full_refresh on a recurring task. Schedule normal updates from a Lakeflow Job on a schedule or a table-update trigger.',
  },
  {
    question: 'Should an expectation warn, drop the row, or fail the update?',
    answer:
      'Warn on bronze, drop rows on silver, and fail the update only for rules where late data is better than wrong data. Dropped rows are not stored, so route them to a quarantine or reject table if someone needs to repair them. All three record counts in the pipeline event log.',
    links: [
      {
        label: 'Manage data quality with pipeline expectations',
        url: 'https://docs.databricks.com/aws/en/ldp/expectations',
      },
    ],
  },
  {
    question: 'Do streaming tables pick up updates and deletes in the source?',
    answer:
      'No. A streaming table processes each row once as it arrives and does not revisit rows, so source updates and deletes are not reflected. Use AUTO CDC for row-by-row change feeds. It needs a key and a sequence column, and supports type 1 and type 2 targets.',
    links: [{ label: 'AUTO CDC', url: 'https://docs.databricks.com/aws/en/ldp/cdc' }],
  },
  {
    question: 'Should I partition my tables or use liquid clustering?',
    answer:
      'Prefer liquid clustering, since partitioning is hard to change later. Add CLUSTER BY AUTO to a pipeline table and Databricks chooses keys from how the table is queried, or name the columns with CLUSTER BY. Predictive optimization then handles maintenance on Unity Catalog managed tables.',
    links: [{ label: 'Liquid clustering', url: 'https://docs.databricks.com/aws/en/delta/clustering' }],
  },
];
