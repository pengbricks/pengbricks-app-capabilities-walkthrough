import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should I store SCD type 1 or type 2?',
    answer:
      'Use type 1 unless a report, audit, or point-in-time join needs earlier values. Type 1 keeps one row per key and stays small. Type 2 keeps one row per version with __START_AT and __END_AT, and the table grows with every tracked change.',
    links: [{ label: 'AUTO CDC in pipelines', url: 'https://docs.databricks.com/aws/en/ldp/cdc' }],
  },
  {
    question: 'What should SEQUENCE BY use?',
    answer:
      'A column from the source that only moves forward for a key, such as a log sequence number or a source commit timestamp. Do not use arrival time. To break ties, use a struct such as STRUCT(commit_ts, event_id), which orders by the first field and falls back to the second.',
  },
  {
    question: 'What happens to a deleted source row?',
    answer:
      'APPLY AS DELETE WHEN removes the row in type 1 and closes the current version in type 2 with no new row. Declare the delete rule in the flow.',
  },
  {
    question: 'How do I stop a type 2 table from growing on every minor change?',
    answer:
      'Add TRACK HISTORY ON for the columns that matter, for example TRACK HISTORY ON * EXCEPT (last_login_at). A change to last_login_at then overwrites the current row instead of adding a version. Without TRACK HISTORY, every column change adds a version.',
  },
  {
    question: 'How do I query a type 2 table?',
    answer:
      'Current rows have a null __END_AT. For a point-in-time join, match the event date to the version whose range contains it. Cluster the table on the key, or use CLUSTER BY AUTO, so these lookups skip files.',
  },
  {
    question: 'What if my source only gives full extracts?',
    answer:
      'Use AUTO CDC FROM SNAPSHOT, which compares each snapshot with the last and derives the inserts, updates, and deletes. It is available in Python. For databases, Lakeflow Connect ingests change data from supported databases so you do not build the capture yourself.',
  },
];
