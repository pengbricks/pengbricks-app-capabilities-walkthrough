import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Which network and security controls do I need to decide before the first workload?',
    answer:
      'Serverless egress control, private connectivity, IP access lists, customer-managed keys, and the compliance security profile. Each one touches how workspaces, storage, and clients connect, so they cost less to design in than to retrofit. Plan the compliance security profile when you create the workspace.',
    links: [{ label: 'Networking overview', url: 'https://docs.databricks.com/aws/en/security/network/' }],
  },
  {
    question: 'Should we still use personal access tokens?',
    answer:
      'Prefer OAuth. PATs are legacy, so disable them where you can, restrict who can create them, give them short lifetimes, and revoke them on a schedule. For automation, use OAuth M2M, or better, workload identity federation, which leaves no long-lived secret.',
    links: [
      {
        label: 'Monitor and revoke personal access tokens',
        url: 'https://docs.databricks.com/aws/en/admin/access-control/tokens',
      },
      { label: 'OAuth token federation', url: 'https://docs.databricks.com/aws/en/dev-tools/auth/oauth-federation' },
    ],
  },
  {
    question: 'Can I grant Unity Catalog privileges to a workspace-local group?',
    answer:
      'No. Unity Catalog grants take account principals, so use account-level groups for every grant and do not create workspace-local groups for access control. Sync users and groups from your identity provider with automatic identity management or SCIM.',
    links: [
      {
        label: 'Automatic identity management',
        url: 'https://docs.databricks.com/aws/en/admin/users-groups/automatic-identity-management',
      },
    ],
  },
  {
    question: 'How do I control spend on serverless compute?',
    answer:
      'Use serverless usage policies and budgets. Cluster policies do not apply to serverless, so they cannot limit it. A policy carries tags that Databricks writes to billing records, and budgets send an email alert when monthly spend crosses a threshold.',
    links: [
      { label: 'Serverless usage policies', url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies' },
    ],
  },
  {
    question: 'Terraform or bundles for administration?',
    answer:
      'Use both, each for its own layer. Terraform owns the platform (workspaces, metastores, networking, groups, catalogs, grants, policies), and bundles own workloads such as jobs, pipelines, and apps. If you adopt one first, pick Terraform, because bundles are aimed at workloads.',
    links: [
      { label: 'Databricks Terraform provider', url: 'https://docs.databricks.com/aws/en/dev-tools/terraform/' },
      { label: 'Declarative Automation Bundles', url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/' },
    ],
  },
  {
    question: 'Why enable system tables at account setup?',
    answer:
      'Billing, audit, lineage, and compute history only start accumulating once the tables are on. The account needs at least one Unity Catalog workspace. Account admins who are also metastore admins can read them by default, and everyone else needs grants on the system catalog.',
    links: [{ label: 'System tables reference', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' }],
  },
];
