import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Who can save an AI-generated comment?',
    answer:
      'The object owner or a user with MODIFY can save a comment on most objects. Views and materialized views need the owner. Nothing is saved until someone accepts the draft, and readers need BROWSE on the catalog to see comments.',
    links: [{ label: 'AI-generated comments', url: 'https://docs.databricks.com/aws/en/comments/ai-comments' }],
  },
  {
    question: 'Can AI-generated comments overwrite what my team already wrote?',
    answer:
      'Not if you use the propose-then-apply pattern. A draft never replaces text a person wrote, so fill only empty comments and skip any column that already has text. Mark what AI wrote with a tag such as comment_source = ai so reviewers can find it later.',
  },
  {
    question: 'Can I use AI comments to find which columns hold PII?',
    answer:
      'No. The model sees the schema, not the data. Use data classification, which scans the catalogs you enable, writes detections to system.data_classification.results, and can apply governed tags that a steward reviews.',
    links: [
      {
        label: 'Data classification',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification',
      },
    ],
  },
  {
    question: 'Should I draft with ai_gen or ai_query?',
    answer:
      'Use ai_query with responseFormat for bulk drafting, because a parseable result and failOnError keep bad rows out of the proposals table. Use ai_gen for quick one-off descriptions. ai_gen is Public Preview and tuned for English, and both are billed per inference.',
    links: [{ label: 'ai_query', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query' }],
  },
  {
    question: 'Does the model see my data when it drafts descriptions?',
    answer:
      'It sees what you put in the prompt, so pass names, types, neighboring columns, lineage table names, and a few profile numbers, and do not send raw sample values from sensitive columns. A Databricks-hosted model keeps the request inside your Databricks geography. An external-model endpoint sends it to that provider under its own terms.',
  },
  {
    question: 'Why use governed tags instead of free-form tags?',
    answer:
      'Governed tags have a fixed set of allowed values, and only permitted users can assign them. Policies and search can rely on them in a way they cannot rely on free-form tags.',
    links: [
      {
        label: 'Apply tags to Unity Catalog securable objects',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/tags',
      },
    ],
  },
];
