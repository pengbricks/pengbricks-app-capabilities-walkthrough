import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Should I use an ABAC policy or a table-level row filter or mask?',
    answer:
      'Use ABAC for rules that follow a classification across many tables, such as masking every email column. One policy covers current and future tagged columns. Use a table-level function when the rule belongs to one table or needs its own lookup that tags cannot express.',
    links: [
      {
        label: 'Attribute-based access control',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
      },
    ],
  },
  {
    question: 'What compute can read ABAC-secured tables?',
    answer:
      'Serverless, standard compute on Databricks Runtime 16.4 or above, or dedicated compute on 16.4 or above with fine-grained access control. Older runtimes cannot read them.',
    links: [
      {
        label: 'Requirements, quotas, and limitations',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/requirements',
      },
    ],
  },
  {
    question: 'What permissions do I need to create a policy, and which tags can it use?',
    answer:
      'MANAGE on the catalog or schema (or ownership) and EXECUTE on the function. ABAC uses governed tags only, and a tag change can take a few minutes to take effect. Because tags decide what is protected, restrict who can assign them.',
    links: [
      {
        label: 'CREATE POLICY',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-policy',
      },
    ],
  },
  {
    question: 'Can I share a table that has a row filter or column mask?',
    answer:
      'No. OpenSharing skips tables that have row filters or column masks. Share a view of the rows and columns the recipient should see instead.',
    links: [{ label: 'Dynamic views', url: 'https://docs.databricks.com/aws/en/views/dynamic' }],
  },
  {
    question: 'Which parts of ABAC are still in beta?',
    answer:
      'ABAC on views, which needs Databricks Runtime 19 or above and does not support metric views, and the metastore-level policy scope. ABAC policies on tables are generally available.',
  },
  {
    question: 'Why does my test query show real data when the policy should mask it?',
    answer:
      'Owners, admins, and principals in an EXCEPT list bypass the policy, so their results prove nothing. Run the same queries as a user or service principal the policy covers, and compare with an exempt principal.',
  },
];
