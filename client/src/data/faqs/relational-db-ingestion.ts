import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which path puts the least load on the production database?',
    answer:
      'A Lakeflow Connect CDC connector. It reads the transaction log, so source load is lowest. Federation queries hit the source every time, and query-based connectors query the source tables on each run.',
    links: [
      {
        label: 'Managed database connectors (CDC)',
        url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/cdc-overview',
      },
    ],
  },
  {
    question: 'When is Lakehouse Federation enough?',
    answer:
      'For exploration, joins between source and Delta tables, one-time loads with CREATE TABLE AS SELECT, and small or rarely read tables. Heavy or repeated use belongs in ingestion, and you should materialize the data if dashboards or models read it often.',
    links: [{ label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' }],
  },
  {
    question: 'What do I do if the database does not support CDC, or I cannot enable it?',
    answer:
      'Use a query-based connector. It needs a reliable cursor column, a monotonically increasing timestamp or integer that changes whenever a row changes. It needs no gateway or CDC setup, and it runs on serverless compute.',
    links: [
      {
        label: 'Query-based connectors',
        url: 'https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/query-based-overview',
      },
    ],
  },
  {
    question: 'What does a query-based connector miss?',
    answer:
      'It captures the latest state of each changed row between runs, not every intermediate state. Hard deletes need extra configuration, though soft deletes can use a deletion condition.',
  },
  {
    question: 'Do the CDC connectors need classic compute?',
    answer:
      'The managed database connectors use a gateway on classic compute to capture the change log, and a serverless pipeline to apply it. The need for a gateway depends on the connector. Also check the release stage of each connector in the docs before committing to one.',
    links: [{ label: 'SQL Server connections with Lakeflow Connect', url: '/walkthroughs/sqlserver-lakeflow-connect' }],
  },
  {
    question: 'How do I run a heavy join without pulling the whole table?',
    answer:
      'Use remote_query to send the SQL to the database, so joins, aggregates, and window functions run there and only the result crosses the wire. The query is written in the source dialect. For simple filters and aggregates, query a foreign catalog instead, and Databricks pushes down what it can.',
    links: [
      {
        label: 'Query external databases using remote_query',
        url: 'https://docs.databricks.com/aws/en/query-federation/remote-queries',
      },
    ],
  },
];
