import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Can a metric view join more than one table?',
    answer:
      'Yes. The source is the fact table and each join is a left outer join to a dimension, and joins can nest for a snowflake schema (runtime 17.3 or above). Each join must be many-to-one, because with many-to-many the engine picks the first matching row. A metric view itself cannot be joined at query time, so wrap the MEASURE() query in a CTE and join the CTE.',
    links: [
      {
        label: 'Joins in metric views',
        url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/joins',
      },
    ],
  },
  {
    question: 'Why not average a ratio or add up distinct counts?',
    answer:
      'Both give the wrong number. Define the numerator and the denominator as measures and divide them with MEASURE(), so the engine sums both for each grouping first. In the reference run, conversion rate was 8.63% overall but 14.23% as an average of daily rates, and active customers were 240 overall but 2,274 when added up by month.',
    links: [
      {
        label: 'Advanced techniques: composability',
        url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/advanced-techniques',
      },
    ],
  },
  {
    question: 'Can I query a metric view with SELECT *?',
    answer:
      'No. SELECT * is not supported. List the fields you group by, wrap each measure in MEASURE(), and add GROUP BY ALL. Dashboards, Genie, and alerts apply MEASURE() for you, while BI tools need custom SQL, a wrapper view, or a partner integration.',
    links: [
      {
        label: 'Use metric views with external BI tools',
        url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/bi-tools',
      },
    ],
  },
  {
    question: 'Can I deploy a metric view with a Declarative Automation Bundle?',
    answer:
      'Not as a bundle resource. CLI 1.17.0 has no metric view resource and the bundle resources page lists none. Keep the YAML in a .sql file in Git, run it from a Lakeflow Jobs SQL task, and set the catalog per target with a bundle variable. Check databricks bundle schema after each CLI upgrade, because a native resource would change the answer.',
    links: [{ label: 'SQL task for jobs', url: 'https://docs.databricks.com/aws/en/jobs/tasks/sql' }],
  },
  {
    question: 'Will a redeploy keep my grants and certification tag?',
    answer:
      'Not with CREATE OR REPLACE VIEW. In the reference run it dropped the certification tag, and the docs say a replace does not keep grants on most views. ALTER VIEW ... AS changed the definition and kept the tag. Re-apply grants and tags in the deploy task, or use ALTER VIEW for updates.',
    links: [
      {
        label: 'Edit a metric view with ALTER VIEW',
        url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/manage',
      },
    ],
  },
  {
    question: 'Can I share a metric view outside my account, and what is still Beta or Preview?',
    answer:
      'You can share it with a Databricks recipient through OpenSharing, which is generally available since September 24, 2026. It cannot be shared if its source tables have row filters, column masks, or ABAC policies. Parameters are Public Preview, and the docs and release notes give no stage for materialization, so confirm it before you rely on it.',
    links: [
      {
        label: 'Metric view feature availability',
        url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/feature-availability',
      },
    ],
  },
];
