import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'What is the difference between a Page and a metric view?',
    answer:
      'A metric view holds the calculation, and a Page holds the definition in words. A Page has an owner, synonyms, a description, a body, sources, and related assets, but it holds no logic. Keep the measure in a metric view and link the Page to it.',
    links: [{ label: 'Pages', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' }],
  },
  {
    question: 'What does Genie One do with a Page?',
    answer:
      'Genie One prioritizes a Page over context it infers and cites the Page in its answers. A draft Page shows up only in Genie One conversations with its owner, and a published Page shows up in all of them.',
  },
  {
    question: 'What is Genie Ontology?',
    answer:
      'Genie Ontology is the context layer that combines modeled knowledge with context Genie learns from governed assets and usage. Modeled knowledge comes from Unity Catalog semantics: metric views, domains, Pages, certification, and curated Genie Agents. It takes precedence when learned context conflicts with a governed definition.',
    links: [{ label: 'Genie Ontology', url: 'https://docs.databricks.com/aws/en/genie/genie-ontology' }],
  },
  {
    question: 'Where should I define a term like revenue?',
    answer:
      'Put it in a metric view measure, with the filter that excludes cancelled orders. Dashboards, SQL users, and Genie then share one definition. Use comments and tags to describe raw columns, and keep agent instructions for rules that belong to one agent.',
    links: [{ label: 'Metric views', url: 'https://docs.databricks.com/aws/en/metric-views/' }],
  },
  {
    question: 'How do I know Genie reads my terms correctly?',
    answer:
      'Use Genie benchmarks. Each one is a business question plus the SQL that returns the right answer. Include a question for each synonym and coded dimension, score before and after each change, and keep the change only when the score rises.',
    links: [{ label: 'Test and monitor a Genie Agent', url: 'https://docs.databricks.com/aws/en/genie/benchmarks' }],
  },
];
