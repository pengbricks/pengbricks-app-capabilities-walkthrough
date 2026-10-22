import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    kind: 'decision',
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
    kind: 'tradeoff',
    question: 'Can I share a table that has a row filter or column mask?',
    answer:
      'Not with a table-level row filter or column mask: the provider cannot share that table. A table secured by ABAC policies can be shared when the share owner is exempt through EXCEPT, and then the recipient receives unfiltered data. To give a recipient only some rows or columns, share a view.',
    links: [
      {
        label: 'OpenSharing and ABAC',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/opensharing',
      },
      { label: 'Governed data sharing', url: '/walkthroughs/data-sharing' },
    ],
  },
  {
    question: 'Which parts of ABAC are still in beta?',
    answer:
      'ABAC on views (September 29, 2026), which needs Databricks Runtime 19 or above and does not support metric views. The metastore-level policy scope (September 17, 2026). Time travel that enforces ABAC policies (September 23, 2026, Databricks Runtime 19). Identity attributes and context attributes in column mask policies. ABAC policies on tables and cross-engine ABAC are generally available.',
  },
  {
    question: 'Why does my test query show real data when the policy should mask it?',
    answer:
      'Owners, admins, and principals in an EXCEPT list bypass the policy, so their results prove nothing. Run the same queries as a user or service principal the policy covers, and compare with an exempt principal.',
  },
  {
    kind: 'decision',
    question: 'Do I need ABAC if I already grant to account groups?',
    answer:
      'Yes, when the rule is about what a reader sees inside a table. A grant decides whether a principal can read the table at all and cannot hide a column or a row. Keep the grants, and add a policy where a classification such as email or national ID must be masked for most readers. The reader needs both.',
    links: [{ label: 'Access management', url: '/walkthroughs/access-management' }],
  },
  {
    kind: 'decision',
    question: 'Should I hash a column or mask it partially?',
    answer:
      'Hash it when analysts must join or count distinct on the value. A salted sha2 gives the same output for the same input, so joins work, and it cannot be reversed directly. Mask it partially, such as the last four characters, when people need to recognize the value. A low-entropy input such as a phone number can be recovered by hashing every candidate, so keep the salt out of reach and rotate it.',
    links: [{ label: 'sha2', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/sha2' }],
  },
  {
    kind: 'tradeoff',
    question: 'Does a row filter or column mask slow my queries?',
    answer:
      'It can. The docs say the complexity of the function directly affects performance. Subqueries or joins against large tables prevent broadcast hash joins, non-deterministic functions limit the optimizer, Python functions are slower than SQL ones, and policies can limit predicate pushdown. Keep the function to a CASE expression over a small mapping table and test with real queries.',
    links: [
      {
        label: 'Performance considerations',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/performance',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Do external engines and Genie Agents see the masked values?',
    answer:
      "Genie Agents run as the end user, so Unity Catalog applies the filters and masks per user. Cross-engine ABAC became generally available on October 1, 2026: supported external engines read managed tables with policies enforced by Databricks serverless compute, read only, and the enforcement is billed. Dynamic views are not supported there. Dashboards follow their publishing mode, and only individual data permissions apply each viewer's own policies.",
    links: [
      { label: 'Cross-engine ABAC', url: 'https://docs.databricks.com/aws/en/external-access/cross-engine-abac' },
      { label: 'Data access in Genie Agents', url: 'https://docs.databricks.com/aws/en/genie-agents/concepts' },
    ],
  },
];
