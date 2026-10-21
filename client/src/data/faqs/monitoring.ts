import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Can teams query system tables without admin rights?',
    answer:
      'Not directly. By default only admins can read system tables. Create views you own that select the columns and workspaces a team needs, and grant SELECT on the view. The group needs USE CATALOG and USE SCHEMA on the view, not access to the system tables.',
    links: [{ label: 'System tables reference', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' }],
  },
  {
    question: 'Do system tables cover all my workspaces?',
    answer:
      'It depends on the table. system.billing.usage and account-level audit events cover the whole account. Audit workspace events, lakeflow, compute, query history, lineage, and ai_gateway usage return only workspaces in the same region as the workspace you query from, so a multi-region estate needs a query or a copy per region.',
  },
  {
    question: 'How long do system tables keep data?',
    answer:
      'Most keep 365 days. node_timeline and endpoint_usage keep 90 days, and inbound network events keep 30 days. For longer history, copy the rows you need into a table you own on a schedule, and keep that copy in Unity Catalog under the same access rules.',
  },
  {
    question: 'Why do I see <REDACTED> in query history?',
    answer:
      'statement_text in system.query.history returns <REDACTED> unless you are an account admin or a member of the databricks_pii_access account group. Grant that group only to people who need the text.',
  },
  {
    question: 'Should I alert from system tables or use job notifications?',
    answer:
      'Use Lakeflow Jobs notifications and health rules first for job failures and slow runs, because they do not depend on table lag. Use Budgets for spend, and a SQL alert over a view only for conditions a query can express. Records arrive minutes to an hour late, so system tables are wrong where you need seconds.',
    links: [{ label: 'Add notifications on a job', url: 'https://docs.databricks.com/aws/en/jobs/notifications' }],
  },
  {
    question: 'Can a budget alert tell me why spend went up?',
    answer:
      'No. A budget says that spend crossed a line, and system.billing.usage says why. Budgets are generally available, an account admin creates them, and they can be scoped by workspace, product, or custom tag. Untagged spend never lands in a tag-scoped budget.',
    links: [
      { label: 'Create and monitor budgets', url: 'https://docs.databricks.com/aws/en/admin/account-settings/budgets' },
    ],
  },
];
