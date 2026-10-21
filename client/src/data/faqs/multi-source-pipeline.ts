import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Append flows, materialized view, or plain view for combining sources?',
    answer:
      'Use append flows for streaming or growing sources, because each source gets its own flow and checkpoint. Use a materialized view with UNION ALL for small batch sources. Keep a plain view for tiny, always-live combinations only, since every read recomputes it and downstream expectations do not run on a view.',
    links: [
      { label: 'Use append flows to write to a streaming table', url: 'https://docs.databricks.com/aws/en/ldp/flows' },
    ],
  },
  {
    question: 'Does adding a new source reprocess the existing ones?',
    answer:
      'No. Each source has its own staging table, append flow, and checkpoint, so a new source adds a flow without touching the others. Append flows suit append-only inputs. Corrections to old rows need AUTO CDC.',
  },
  {
    question: 'Why store source_id as a string?',
    answer:
      'Casting keys to STRING lets numeric, padded, and composite keys from different systems share one column. The pair (source_system, source_id) is the natural key of the conformed table.',
  },
  {
    question: 'Where should expectations go?',
    answer:
      "Both places. Put source-specific checks, such as date format and status codes, on each staging table, so one source's problems do not hide in the merged table. Put the shared contract on the conformed table, and use FAIL UPDATE for breaks that mean a mapping bug.",
    links: [
      {
        label: 'Manage data quality with pipeline expectations',
        url: 'https://docs.databricks.com/aws/en/ldp/expectations',
      },
    ],
  },
  {
    question: 'How do I decide two records are the same customer?',
    answer:
      'Match exactly on a normalized key first and merge those automatically. Add edit distance on blocked candidates for the rest, and use ai_similarity only on pairs edit distance cannot settle. Send the uncertain middle band to a review table, and keep a crosswalk so you can undo a wrong merge.',
  },
  {
    question: 'What should I know before using ai_similarity?',
    answer:
      'It is in Public Preview and tuned for English. Each comparison calls a model, so it adds cost and latency, and the scores are harder to explain to a reviewer. Apply it only to candidate pairs.',
    links: [
      {
        label: 'ai_similarity function',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_similarity',
      },
    ],
  },
];
