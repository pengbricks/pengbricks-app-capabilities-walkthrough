import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Are Databricks Pages generally available?',
    answer:
      'Yes. Pages became generally available on November 11, 2026. The GA release added MANAGE PAGES, certification and deprecation, and REST API management.',
    links: [
      { label: 'Pages', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
      {
        label: 'November 2026 release notes',
        url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/november',
      },
    ],
  },
  {
    question: 'What is the difference between a Page and a metric view?',
    answer:
      'A Page defines a concept in words and holds its owner, synonyms, sources, and related assets. A metric view implements a governed calculation. Explain revenue on a Page, calculate it in a metric view, and link the two.',
  },
  {
    question: 'What does Genie One do with a Page?',
    answer:
      'Genie One prioritizes the published Page over conflicting learned context and cites it in the answer. A draft is available only in conversations with its owner; a published Page is available under the permissions inherited from its domain.',
  },
  {
    question: 'Who should own, publish, and certify a Page?',
    answer:
      'The concept owner is accountable for the definition. A steward group with MANAGE PAGES reviews and publishes it. A domain curator with MANAGE DOMAIN or MANAGE DISCOVER certifies or deprecates it.',
  },
  {
    question: 'Can Pages contain sensitive information?',
    answer:
      'Do not put PII, regulated data, secrets, or customer records in Page names, descriptions, synonyms, or body text. Page data can replicate globally and does not support customer-managed keys.',
  },
  {
    question: 'Can I manage Pages as code?',
    answer:
      'The REST API supports create, list, get, update, and delete operations. Create drafts, use explicit update masks, supply request IDs for retry safety, require review before publication, and read the deployed Page back after every change.',
    links: [{ label: 'Pages REST API', url: 'https://docs.databricks.com/api/workspace/knowledge/pages' }],
  },
];
