import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'When should I use a metric view instead of a standard view?',
    answer:
      'Use a metric view for any measure that more than one consumer needs, and a standard view for fixed shapes. A standard view locks in its grouping when you create it, so each new grouping becomes a new view and the formula gets copied. A metric view stores measures and dimensions separately, so one definition serves every grouping.',
    links: [
      {
        label: 'Unity Catalog metric views',
        url: 'https://docs.databricks.com/aws/en/metric-views/',
      },
    ],
  },
  {
    question: 'Do I need a dashboard, Genie, or a notebook chart?',
    answer:
      'Use a dashboard for the recurring view, Genie for follow-up questions on the same metric view, and notebook charts for analysis. A dashboard is governed and fixed by its authors. Genie is flexible but answer quality depends on how well the space is set up, so people should read the SQL it shows.',
    links: [{ label: 'AI/BI dashboards', url: 'https://docs.databricks.com/aws/en/dashboards/' }],
  },
  {
    question: 'Can Power BI or Tableau use a metric view?',
    answer:
      'Yes. Power BI and Tableau can query metric views, so a report outside Databricks shares the definition. Metric views are queried with MEASURE(), and BI tools read them over OAuth.',
    links: [{ label: 'Create a metric view', url: 'https://docs.databricks.com/aws/en/metric-views/create' }],
  },
  {
    question: 'Do dashboard viewers need access to the underlying tables?',
    answer:
      'Not with shared data permissions, which give every viewer the same data and a shared cache. With individual data permissions, queries run as each viewer, so row filters and column masks apply. Grant viewers access to the dashboard and its data through groups.',
  },
  {
    question: 'How do I keep a dashboard and a notebook chart showing the same number?',
    answer:
      'Read both from the same governed view or metric view. Point each dashboard dataset at it and keep the SQL short. Before you publish a metric change, compare the dashboard dataset and the view for the same filter, and run a reconciliation in a job to catch drift in logic.',
    links: [
      {
        label: 'Visualizations in notebooks and the SQL editor',
        url: 'https://docs.databricks.com/aws/en/notebooks/visualizations/',
      },
    ],
  },
  {
    question: 'How do I put dashboards under change control?',
    answer:
      'Deploy them with the bundle dashboard resource, which keeps the definition in Git so changes are reviewed and promoted across environments. Set permissions with Unity Catalog, and tag the metric views and governed views approved for reporting so authors pick them first.',
    links: [{ label: 'AI/BI dashboards', url: 'https://docs.databricks.com/aws/en/dashboards/' }],
  },
];
