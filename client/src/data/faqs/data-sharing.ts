import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which recipient type should I create?',
    answer:
      'Create a Databricks-to-Databricks recipient when the consumer has a Unity Catalog workspace. It needs no token, and the recipient adds its own governance, including its own row filters and column masks. Use an open recipient only for people on other platforms.',
    links: [
      {
        label: 'Databricks-to-Databricks protocol',
        url: 'https://docs.databricks.com/aws/en/delta-sharing/share-data-databricks',
      },
    ],
  },
  {
    question: 'Can I share a table that has row filters or column masks?',
    answer:
      'No. The provider skips tables with row filters or column masks. Create a view that selects only the rows and columns the recipient should see, and add the view to the share instead of the base table. Sharing ABAC-secured tables is in preview, and the policy does not govern what the recipient reads.',
    links: [{ label: 'Create shares', url: 'https://docs.databricks.com/aws/en/delta-sharing/create-share' }],
  },
  {
    question: 'How do I secure access for a recipient outside Databricks?',
    answer:
      "Prefer OIDC federation, where the recipient's identity provider issues short-lived tokens and enforces MFA. If you must use a bearer token, set a short lifetime, add an IP access list, and renew it on a schedule. Drop or rotate the recipient when the engagement ends.",
    links: [
      {
        label: 'OIDC federation for recipients',
        url: 'https://docs.databricks.com/aws/en/delta-sharing/create-recipient-oidc-fed',
      },
    ],
  },
  {
    question: 'Does sharing cost anything?',
    answer:
      "Sharing within a region has no egress charge. When the recipient reads from another region or cloud, your cloud provider can bill data transfer, and large, frequently read tables multiply it. To contain it, share from Cloudflare R2, replicate the table into the recipient's region once, or have recipients read once and cache.",
  },
  {
    question: 'What privileges do I need to create a share and grant it?',
    answer:
      'Creating a share needs CREATE SHARE on the metastore. Adding an asset needs share ownership, USE CATALOG and USE SCHEMA on its parents, and SELECT on the asset. Creating a recipient needs metastore admin or CREATE RECIPIENT. Give these to a group, and make a group the share owner.',
  },
  {
    question: 'When should I use Clean Rooms or Marketplace instead of a share?',
    answer:
      "Start with a share to a named recipient. Move to Clean Rooms when neither side may see the other's raw rows, and to Marketplace when the audience is open. Replicate to the recipient's storage only when it needs a writable or isolated copy.",
    links: [{ label: 'Clean Rooms', url: 'https://docs.databricks.com/aws/en/clean-rooms/' }],
  },
  {
    kind: 'decision',
    question: 'Should I share a table with or without history?',
    answer:
      'Keep WITH HISTORY, the default on Databricks Runtime 16.2 and above, when recipients need time travel, streaming, or the change feed, or when Databricks recipients read large tables. Databricks says it speeds Databricks-to-Databricks reads by using scoped cloud-storage credentials. Use WITHOUT HISTORY when past versions must stay private. Partitioned tables get no speed-up either way.',
    links: [
      {
        label: 'History sharing performance',
        url: 'https://docs.databricks.com/aws/en/delta-sharing/share-data-databricks',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does sharing history expose to a recipient?',
    answer:
      'The recipient can query earlier table versions, including rows you later updated or deleted. If a table once held data you corrected or removed, share it WITHOUT HISTORY, or share a view. To change history on a table already in a share, run ALTER SHARE with ADD TABLE and the WITH HISTORY or WITHOUT HISTORY option you want.',
    links: [{ label: 'Create shares', url: 'https://docs.databricks.com/aws/en/delta-sharing/create-share' }],
  },
  {
    kind: 'decision',
    question: 'Should I federate, share, or copy the data?',
    answer:
      'Share when others need live access to your Unity Catalog data. Federate when you need to query another system, such as a database, Hive metastore, or Glue, without moving it. Copy when you need high volume, low latency, or a writable copy. Databricks recommends Lakeflow Connect over federation when volume and latency matter.',
    links: [{ label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' }],
  },
  {
    kind: 'tradeoff',
    question: 'Can a recipient stream from a share, and what does it cost?',
    answer:
      'Yes, when history is shared and the recipient uses Databricks Runtime 12.2 LTS or above. Streaming gives low latency but needs a running stream and a plan for rows the provider updates or deletes. For a daily need, batch snapshots are simpler. Streaming tables and materialized views give open recipients the current snapshot only.',
    links: [
      {
        label: 'Read shared data',
        url: 'https://docs.databricks.com/aws/en/delta-sharing/read-data-databricks',
      },
    ],
  },
];
