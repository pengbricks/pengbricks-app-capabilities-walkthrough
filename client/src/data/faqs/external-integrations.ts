import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which identity should a BI tool or app use to connect?',
    answer:
      'Use user-to-machine OAuth for interactive BI, so each person sees only what their own grants allow. Use machine-to-machine OAuth with a scoped service principal for scheduled reports and apps. Use a personal access token only where the tool has no OAuth option, because it is a long-lived secret tied to one person.',
    links: [
      {
        label: 'OAuth machine-to-machine (M2M) authentication',
        url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m',
      },
    ],
  },
  {
    question: 'When should I federate a source instead of ingesting it?',
    answer:
      'Federate data that is small, fresh, or rarely read, such as a lookup table or a proof of concept. Ingest with a managed Lakeflow Connect connector when many people read it. Every federated query hits the source, so speed depends on the source and heavy or repeated reads load that system.',
    links: [{ label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' }],
  },
  {
    question: 'Should I use Fivetran or dbt, or a Lakeflow Connect connector?',
    answer:
      'Prefer a managed Lakeflow Connect connector when one covers the source, since it costs less to run than a third-party pipeline. Use a partner ELT tool where no managed connector exists or your team already runs the tool. Give each partner tool its own service principal with least privilege so you can audit and revoke it alone.',
    links: [{ label: 'dbt with Databricks', url: 'https://docs.databricks.com/aws/en/partners/prep/dbt' }],
  },
  {
    question: 'Why not point an app straight at a SQL warehouse for single-row reads and writes?',
    answer:
      'Analytical engines are the wrong back end for an app that reads and writes single rows with low latency. Use Lakebase, managed Postgres, as the operational database. Synced tables copy Unity Catalog data into it so the app reads curated data without querying the warehouse on each request.',
    links: [{ label: 'Lakebase Postgres', url: 'https://docs.databricks.com/aws/en/oltp/' }],
  },
  {
    question: 'How do other engines read Databricks tables?',
    answer:
      'Use OpenSharing (formerly Delta Sharing) or the Unity Catalog Iceberg REST catalog. Both give live, governed access with no copy. An outside Iceberg engine authenticates with a service principal using OAuth M2M and receives vended credentials.',
    links: [{ label: 'OpenSharing', url: 'https://docs.databricks.com/aws/en/opensharing' }],
  },
  {
    question: 'What does a dashboard with many viewers need on the warehouse side?',
    answer:
      'A warehouse sized and scaled for concurrency, ideally serverless so the tool does not wait for startup. Put metric views behind the dashboards so every tool reports the same numbers. Use named query parameters instead of building SQL strings.',
    links: [{ label: 'Connect Power BI', url: 'https://docs.databricks.com/aws/en/partners/bi/power-bi' }],
  },
];
