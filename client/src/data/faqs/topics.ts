// FAQ topics that span guides. Each topic's questions live in faqs/<slug>.ts, like a guide's.

export type FaqTopic = { slug: string; title: string; summary: string };

export const faqTopics: readonly FaqTopic[] = [
  {
    slug: 'databricks-apps',
    title: 'Databricks Apps and Serverless Micro Apps',
    summary:
      'How to choose between a Databricks App on its own compute, an app built with Genie App Builder in an App Space (Beta), and the announced Serverless Micro Apps runtime, with the tradeoffs of each.',
  },
  {
    slug: 'lakebase-apps',
    title: 'App development with Lakebase',
    summary:
      'Building apps that read and write Lakebase Postgres: when to use it, how an app connects and authenticates, keeping it in step with lakehouse tables, and the tradeoffs of each choice.',
  },
  {
    slug: 'sql-warehouse-types',
    title: 'SQL warehouse types: Classic, Pro and Serverless',
    summary:
      'When to use each SQL warehouse type and why, which features each one lacks, where Databricks is taking them, and how they relate to classic and serverless compute elsewhere on the platform.',
  },
  {
    slug: 'unity-catalog-edm',
    title: 'Unity Catalog with an enterprise data management program',
    summary:
      'How Unity Catalog fits alongside an enterprise data catalog, data governance program, or master data management tool: what each one owns, how metadata moves between them, and the tradeoffs of each split.',
  },
];
