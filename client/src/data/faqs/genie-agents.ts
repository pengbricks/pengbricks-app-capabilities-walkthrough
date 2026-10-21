import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Whose permissions apply when someone asks a question?',
    answer:
      "The asker's. Unity Catalog checks every table as the person who asked, so grants, row filters, and column masks hold, and a question about data the user cannot see returns an empty answer. The author's embedded credential only opens the SQL warehouse, so business users need no warehouse permission.",
    links: [
      { label: 'Create and manage a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/set-up' },
    ],
  },
  {
    question: 'Which warehouse can a Genie Agent use?',
    answer:
      'A pro or serverless SQL warehouse. Classic warehouses are not supported. Databricks recommends serverless, sized larger rather than smaller and with the maximum cluster count set for peak concurrency. Agent mode runs several queries per question, so it needs more headroom than Chat mode.',
    links: [
      {
        label: 'Size and scale a SQL warehouse',
        url: 'https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-behavior',
      },
    ],
  },
  {
    question: 'Does Genie copy our data, and what does Databricks store?',
    answer:
      'Genie never copies table data. Databricks stores the agent definition, conversations, generated SQL, and feedback in the control plane database, AES-256 encrypted. Query results expire after seven days, and entity matching values sit in your workspace storage.',
    links: [
      {
        label: 'Use a Genie Agent to explore business data',
        url: 'https://docs.databricks.com/aws/en/genie-agents/talk-to-genie',
      },
    ],
  },
  {
    question: 'Where should I put business definitions, in text instructions or somewhere else?',
    answer:
      'Put them in SQL. Define revenue in a metric view or a SQL expression, and use example SQL for the hard questions. Text instructions carry only defaults, clarification rules, and formatting. Text is the last resort because examples change the generated SQL more than text does.',
    links: [{ label: 'Tune Genie Agent quality', url: 'https://docs.databricks.com/aws/en/genie-agents/tune-quality' }],
  },
  {
    question: 'How many tables can one agent use?',
    answer:
      'The hard limit is 50 tables, views, or metric views, but aim for five or fewer and scope each agent to one business domain. Each agent also holds at most 100 instructions. Too many instructions lower accuracy, especially in long conversations, so prune before you add.',
  },
  {
    question: 'How do I move an agent from dev to production?',
    answer:
      'Iterate in the UI, then move the final definition into a bundle with the genie_spaces resource so it sits in Git and deploys per target. The bundle needs the direct deployment engine, and the tables must exist at deploy time. Use the REST API for scripted tests against a deployed agent.',
    links: [
      {
        label: 'Bundle resources: genie_spaces',
        url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources',
      },
    ],
  },
];
