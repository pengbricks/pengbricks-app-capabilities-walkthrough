import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'How do I tag serverless spend when there is no cluster?',
    answer:
      'Assign a serverless usage policy to the user, group, or service principal. Its tags appear in custom_tags in system.billing.usage. Assignment applies to new work, so update existing jobs to attach a policy. Serverless usage policies were renamed from budget policies, and the billing column is usage_policy_id.',
    links: [
      { label: 'Serverless usage policies', url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies' },
    ],
  },
  {
    question: 'How do I enforce tagging?',
    answer:
      'Set a required or fixed custom tag in compute policies for classic compute, and assign a serverless usage policy to every user, group, and service principal. Then report the share of cost with no value for your required tag, by workspace and owner. That list is the work queue.',
    links: [{ label: 'Compute policies', url: 'https://docs.databricks.com/aws/en/admin/clusters/policies' }],
  },
  {
    question: 'Can I split the cost of a shared SQL warehouse by team?',
    answer:
      'Yes, with query tags (generally available). They land in system.query.history.query_tags, but the billing table does not carry them. You design the allocation rule that turns query activity into dollars.',
    links: [{ label: 'Query tags', url: 'https://docs.databricks.com/aws/en/sql/user/queries/query-tags' }],
  },
  {
    question: 'Which should I use, tags or a workspace per team?',
    answer:
      'Use tags and serverless usage policies as the default, with a small tag set that compute policies enforce. Use a workspace per team where isolation already calls for it, since billing records carry workspace_id. Shared catalogs, warehouses, and jobs still need another way to split their cost.',
  },
  {
    question: 'What can I do when tags are missing?',
    answer:
      'Use usage_metadata and identity_metadata. usage_metadata identifies the cluster, warehouse, job and run, pipeline, endpoint, or app behind a record, and identity_metadata.run_as, owned_by, and created_by identify who. Only some fields are filled for each product.',
    links: [
      { label: 'Billable usage system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing' },
    ],
  },
  {
    question: 'How much history do I need before forecasting spend?',
    answer:
      'At least a couple of full cycles of the pattern. For a monthly budget, that means two or more months of daily cost. Forecast per product or team with ai_forecast, act on the lower and upper bounds rather than the midpoint, and re-run as new data arrives.',
    links: [
      { label: 'ai_forecast', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_forecast' },
    ],
  },
];
