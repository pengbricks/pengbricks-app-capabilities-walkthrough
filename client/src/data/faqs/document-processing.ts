import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'What are the limits of ai_parse_document?',
    answer:
      'A document can have up to 500 pages and 100 MB, and a longer one fails unless you pass pageRange. Inputs are PDF, JPG, PNG, TIFF, DOC and DOCX, and PPT and PPTX. Accuracy is weaker on non-Latin text such as Japanese or Korean, and digital signatures may not be processed accurately. You cannot swap the model.',
    links: [
      {
        label: 'ai_parse_document',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document',
      },
    ],
  },
  {
    question: 'Why store the parsed output instead of parsing on demand?',
    answer:
      'Parsing is the per-page cost, so storing the result means a retry, a new question, or a dashboard refresh does not bill the same pages again. Parse on demand only for a one-time question over a document you will not see again.',
  },
  {
    question: 'When should I use the Agent Bricks UIs instead of the SQL functions?',
    answer:
      'Use them to prepare and tune, then call the functions in the pipeline. Agent Bricks Classification (Public Preview as of the March 2026 release notes) tunes labels, and Information Extraction adds evaluation and versions when editing field descriptions is not enough. The pipeline still runs ai_classify and ai_extract.',
    links: [
      {
        label: 'Agent Bricks Information Extraction',
        url: 'https://docs.databricks.com/aws/en/agents/agent-bricks/info-extraction',
      },
    ],
  },
  {
    question: 'How do I keep wrong extractions out of downstream systems?',
    answer:
      'Validate every document before trusting it. A document passes when required fields are not null, every confidence is at or above your threshold, dates parse, and amounts are in range. Anything else goes to a quarantine table with the reasons and a pending review status. Keep the confidence floor, because the same input can return different answers between runs.',
  },
  {
    question: 'Is ai_mask enough to protect personal data?',
    answer:
      'Not alone. ai_mask is in Public Preview, tuned for English, and can miss a value, so test for leaks with planted names, emails, and phone numbers. Use Unity Catalog column masks for known columns, and restrict the unmasked parsed table to the pipeline and reviewers.',
    links: [{ label: 'ai_mask', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_mask' }],
  },
  {
    question: 'How do I estimate the annual cost?',
    answer:
      'Run about 100 representative documents, read the billed DBUs from system.billing.usage, and divide by pages. Annual DBUs equal cost per page times pages per year, growth, and the share reprocessed. There is no fixed price per page, because rates differ by contract. Billing lags, with records typically available within 12 hours.',
    links: [
      { label: 'Billable usage system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing' },
    ],
  },
];
