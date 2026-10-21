import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Can I use http_request for bulk extraction?',
    answer:
      'No. http_request in SQL through a Unity Catalog HTTP connection is enough for a small lookup or enrichment call. For bulk loads, use a managed connector first, then land raw responses for Auto Loader, a Python data source, or a custom connector.',
    links: [
      { label: 'Connect to external HTTP services', url: 'https://docs.databricks.com/aws/en/query-federation/http' },
    ],
  },
  {
    question: 'Which custom path should I pick when no managed connector exists?',
    answer:
      'Land raw responses and ingest them with Auto Loader, since it is the easiest to debug and replay. Choose a Python data source when you need parallel reads or a Spark-native source, and a custom Lakeflow Connect connector when you accept Beta. Release stage varies by managed connector too, so check it before you commit.',
    links: [{ label: 'Custom connectors', url: 'https://docs.databricks.com/aws/en/ingestion/custom-connectors' }],
  },
  {
    question: 'Where should the API credential live?',
    answer:
      "Use a Unity Catalog connection for HTTP APIs and a service credential for cloud-provider APIs. Use a secret scope for the rest, scoped to the job's service principal. Never put tokens in code, job parameters, widget values, or log lines.",
    links: [{ label: 'Secrets', url: 'https://docs.databricks.com/aws/en/security/secrets/' }],
  },
  {
    question: 'Which HTTP errors should the client retry?',
    answer:
      'Refresh the token and retry once on a 401. Back off and retry up to 5 times on 429, honoring Retry-After, and on 5xx or network errors. Stop the run on any other 4xx. Log every attempt in a request log.',
  },
  {
    question: 'How do I avoid duplicates when a pull is retried?',
    answer:
      'Keep a cursor in a state table and MERGE on the record key. Advance the cursor only after the data commits. Start each pull slightly before the stored mark to catch late updates, and let MERGE absorb the repeats.',
  },
  {
    question: 'Why keep a raw copy of each response?',
    answer:
      'You can replay a parsing fix without calling the API again. That matters when the API rate-limits or keeps only recent data.',
  },
];
