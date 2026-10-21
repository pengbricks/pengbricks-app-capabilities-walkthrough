import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Will a business user see data they are not allowed to see?',
    answer:
      "No. The agent runs queries on the warehouse you pick, but Genie evaluates each question with the asker's own Unity Catalog permissions, and row filters and column masks apply. Users need workspace access, a SQL entitlement, and access to the underlying data.",
    links: [{ label: 'Set up a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/set-up' }],
  },
  {
    question: 'Does user feedback or a benchmark retrain the agent?',
    answer:
      'No. Feedback does not change the agent by itself, and benchmarks are for evaluation only because Genie does not learn from them. An owner reviews flagged answers each week and turns each fix into an instruction, example query, or trusted asset.',
    links: [{ label: 'Monitor a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie-agents/monitor' }],
  },
  {
    question: 'What should I add first to improve answer quality?',
    answer:
      'Start with Unity Catalog descriptions and metric views, then SQL expressions and example queries, and use text instructions last. Keep the agent narrow, ideally five or fewer tables. Use trusted assets for figures that must be exact, such as regulated or board metrics.',
    links: [
      {
        label: 'Curate an effective Genie Agent',
        url: 'https://docs.databricks.com/aws/en/genie-agents/best-practices',
      },
    ],
  },
  {
    question: 'What compute does Genie need, and how big should it be?',
    answer:
      'A Pro or serverless SQL warehouse. Serverless is preferred because it starts fast and scales for concurrent users. Start small, watch query queue time and latency in query history during the pilot, and resize before you expand.',
  },
  {
    question: 'How do I get the agent into Slack or Teams?',
    answer:
      'You can share it there, but the Teams app is in Beta and Slack features are in preview, so check the release notes before you commit. Start in Genie One for the pilot cohort and add chat channels when users ask for them.',
    links: [{ label: 'Genie One', url: 'https://docs.databricks.com/aws/en/genie-one/' }],
  },
  {
    question: 'Can I keep the agent in Git and promote it from dev to production?',
    answer:
      'Yes. Genie Agents have a Declarative Automation Bundles resource, so tables, instructions, sample questions, and example queries can live in Git. Create the agent in the UI while you iterate, then move the final definition into a bundle.',
    links: [{ label: 'Bundle resources', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources' }],
  },
];
