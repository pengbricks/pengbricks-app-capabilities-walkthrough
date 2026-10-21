import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'When should I move from the SQL editor to a notebook?',
    answer:
      'Move to a serverless notebook for multi-step analysis, plots, and Python libraries. The SQL editor on a serverless warehouse suits exploration, joins, aggregates, and shared queries. Both use the same Unity Catalog permissions, so access rules are defined once.',
    links: [{ label: 'Serverless SQL warehouses', url: 'https://docs.databricks.com/aws/en/admin/sql/serverless' }],
  },
  {
    question: 'How do I use pandas without running out of memory?',
    answer:
      'Aggregate in Spark first and call toPandas only on a small result, since pandas runs on the driver and the result has to fit in its memory. When the data is too large to collect, use the pandas API on Spark, which keeps pandas syntax and runs distributed. Not every pandas function is available there, so test a port first.',
    links: [{ label: 'Pandas API on Spark', url: 'https://docs.databricks.com/aws/en/pandas/pandas-on-spark' }],
  },
  {
    question: 'How do I let many people reuse one query safely?',
    answer:
      'Use parameter markers such as :status. They add a parameter widget in the editor and a bound parameter in a notebook or job, which avoids string formatting and SQL injection. Store notebooks and SQL files in a Git folder so changes are reviewed and versioned.',
  },
  {
    question: 'A query is slow. Should I resize the warehouse?',
    answer:
      'Read the query profile first and fix the slowest operator before you resize. A larger size speeds one query, while more clusters help many users at once. For a heavy aggregate that many people read, build a materialized view and query that.',
    links: [{ label: 'Query profile', url: 'https://docs.databricks.com/aws/en/sql/user/queries/query-profile' }],
  },
  {
    question: 'Can I run R on serverless?',
    answer:
      'No. Serverless notebooks and jobs run Python and SQL, and hosted RStudio on Databricks is end-of-life. Use RStudio Desktop or Posit Workbench with sparklyr over Databricks Connect, odbc::databricks() against a SQL warehouse, or an R notebook on classic compute. Write new code with sparklyr, because SparkR is deprecated on Databricks Runtime 16 and above.',
    links: [
      {
        label: 'Databricks Connect for R',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/r/',
      },
    ],
  },
  {
    question: 'What is the difference between Genie Code and Genie?',
    answer:
      'Genie Code writes, explains, and fixes SQL and Python in the editor and notebooks. Genie answers business questions in plain language on curated data and shows the SQL it ran, so users can check it. Genie uses the same Unity Catalog grants as the SQL editor and notebooks.',
    links: [{ label: 'Genie Code', url: 'https://docs.databricks.com/aws/en/genie-code/' }],
  },
];
