import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Is Lakeflow Designer generally available?',
    answer: 'Yes. Lakeflow Designer is GA.',
    links: [{ label: 'Lakeflow Designer', url: 'https://docs.databricks.com/aws/en/designer/' }],
  },
  {
    question: 'Can a business user write to production tables from Designer?',
    answer:
      "Not directly. A flow reads and writes with the signed-in user's privileges, and builders get CREATE TABLE on a sandbox schema only. A production schema gets its table from a job running as a service principal, after the flow is reviewed in Git.",
  },
  {
    question: 'Do we have to rebuild a flow in code to run it on a schedule?',
    answer:
      'No. Designer saves each visual data prep as a notebook named <name>.designer.ipynb. Schedule it with the Schedule button, run it as a job task, or deploy it with a bundle from a Git folder.',
    links: [
      { label: 'Move a visual data prep to production', url: 'https://docs.databricks.com/aws/en/designer/production' },
    ],
  },
  {
    question: 'How do I keep a measure in a prepared dataset consistent with our dashboards?',
    answer:
      'Use a metric view as a Source and pick its dimensions and measures. The number then matches the same measure in AI/BI dashboards.',
  },
  {
    question: 'When should a flow move to SQL or a declarative pipeline?',
    answer:
      'When it needs tests, shared logic, or high volume. The generated code is the starting point for the engineer. Designer suits repeatable cleanup and joins by a business user.',
    links: [{ label: 'Lakeflow Spark Declarative Pipelines', url: 'https://docs.databricks.com/aws/en/ldp/' }],
  },
  {
    question: 'Should users build in Designer or ask Genie?',
    answer:
      'Use Designer for repeatable cleanup that must produce a table. Use Genie Agents or Genie One for a one-off answer in plain language, since they save no pipeline and do not produce a repeatable table. Check the SQL Genie shows.',
    links: [{ label: 'Genie Agents', url: 'https://docs.databricks.com/aws/en/genie-agents/' }],
  },
];
