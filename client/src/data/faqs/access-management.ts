import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Why can I not grant to a workspace-local group?',
    answer:
      'Unity Catalog privileges attach to account-level principals, and workspace-local groups are not Unity Catalog principals. Create groups in the account and sync them from your identity provider with automatic identity management or SCIM.',
    links: [
      {
        label: 'Manage privileges in Unity Catalog',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/',
      },
    ],
  },
  {
    question: 'Why a catalog per environment instead of a schema per environment?',
    answer:
      'Two schemas in one catalog share a blast radius. A separate catalog bound to its own workspace is denied from other workspaces even for users who hold privileges on it, and you can mark a binding read-only.',
    links: [
      {
        label: 'Workspace-catalog binding',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/workspace-catalog-binding',
      },
    ],
  },
  {
    question: 'When should I use ABAC instead of grants?',
    answer:
      'Use ABAC when a rule follows a classification across many tables, such as hiding PII from everyone but compliance. One policy on a governed tag covers every tagged table, including new ones. Use catalog or schema grants for team and environment access, and per-table rules only for exceptions.',
    links: [
      {
        label: 'Attribute-based access control',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
      },
    ],
  },
  {
    question: 'Which ABAC policy types are generally available?',
    answer:
      "Row filter and column mask policies are generally available, including cross-engine enforcement. GRANT policies give dynamic privileges based on tags. A principal's effective privileges are the union of direct grants and GRANT policies, so review both.",
  },
  {
    question: 'How do I let people find data without letting them read it?',
    answer:
      'Grant BROWSE on a catalog. People see object names and comments in search and Catalog Explorer without reading data, so they know what to request. Use READ METADATA for auditors and stewards who need to view metadata such as policies.',
  },
  {
    question: 'How do I audit permission changes?',
    answer:
      "Query system.access.audit for service_name = 'unityCatalog' and action_name = 'updatePermissions'. Permission changes are metastore-level events, so filter by securable name in request_params rather than by workspace_id. Alert on grants to individual users, ALL PRIVILEGES, and ownership changes on production objects.",
    links: [
      { label: 'Audit log system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/audit-logs' },
    ],
  },
];
