import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Can I use a personal access token in a shared workbook?',
    answer:
      'No. Do not put a personal access token in a shared tool. People sign in with OAuth user-to-machine (U2M) in the browser, and scheduled or shared tools use a service principal with OAuth machine-to-machine (M2M).',
    links: [
      {
        label: 'Authorize access with OAuth',
        url: 'https://docs.databricks.com/aws/en/dev-tools/auth/',
      },
    ],
  },
  {
    question: 'Will row filters and masks apply in Excel or Power BI?',
    answer:
      'Yes, when the user signs in with U2M. Queries run as the person, so Unity Catalog grants, row filters, and masks apply per user and the audit log names them. A service principal gives everyone using it the same access, so per-person row filters do not apply.',
  },
  {
    question: 'Which Python client should I use, the SQL connector or Databricks Connect?',
    answer:
      'Use the SQL connector for scripts that need rows back, for example into pandas. Use Databricks Connect for DataFrame code and tests, run on serverless compute from your IDE. The SQL connector has no DataFrame API, and Databricks Connect has a heavier install and a client version that must match the compute.',
    links: [
      {
        label: 'Databricks SQL connector for Python',
        url: 'https://docs.databricks.com/aws/en/dev-tools/python-sql-connector',
      },
    ],
  },
  {
    question: 'How do SAS and SPSS connect?',
    answer:
      'Through the Databricks ODBC or JDBC driver, configured with the warehouse host and HTTP path and signed in with OAuth. Use M2M for batch jobs. Use ODBC or JDBC only where the tool requires it, since it needs per-tool driver setup and has no DataFrame API.',
    links: [{ label: 'Databricks ODBC driver', url: 'https://docs.databricks.com/aws/en/integrations/odbc/' }],
  },
  {
    question: 'Can our identity provider issue the tokens so no secret sits on the client?',
    answer:
      "Yes, with OAuth token federation. The client exchanges the identity provider's token for a Databricks token, so it holds no Databricks secret. You set up a federation policy and depend on the identity provider's tokens.",
    links: [
      {
        label: 'OAuth token federation',
        url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-federation',
      },
    ],
  },
  {
    question: 'How should I size the warehouse for BI users?',
    answer:
      'Use a serverless SQL warehouse, give BI its own warehouse so a heavy ETL job cannot slow a report, and tag it for cost attribution. Set a minimum and maximum cluster count. Queries queue when all clusters are busy, so raise the maximum if reports wait.',
    links: [{ label: 'SQL warehouses', url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/' }],
  },
];
