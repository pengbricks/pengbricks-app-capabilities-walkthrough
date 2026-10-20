import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'row-column-security',
  area: 'Governance/Monitoring',
  title: 'Row and column security',
  intro:
    'Row filters hide rows and column masks rewrite values, both enforced by Unity Catalog at query time. The current pattern is attribute-based access control (ABAC): tag the data with governed tags and write one policy per tag, instead of a function on every table. ABAC policies are generally available and, with cross-engine ABAC, also apply when supported external engines read your managed tables. Per-table filter and mask functions remain the right tool for a rule that belongs to one table. This page covers both, how to find sensitive columns, the limits that matter, and how to list what is in force.',
  businessValue: {
    summary:
      'Compliance and data owners need sensitive rows and values hidden from people who should not see them, without maintaining a copy per audience. This guide covers ABAC policies, row filters, and column masks enforced at query time.',
    outcomes: [
      {
        title: 'PII masked at query time',
        body:
          'Column masks rewrite values for people without the right group membership. Analysts keep working on the same table and see masked values, so no separate redacted copy exists.',
      },
      {
        title: 'One policy covers new tables',
        body:
          'An ABAC policy on a catalog or schema applies to every table or column with the governed tag, including tables created later. Coverage does not depend on someone remembering to add a rule.',
      },
      {
        title: 'Regional or team data separation',
        body:
          'Row filters show each group only its own rows, such as one region or business unit. The rule lives on the data, so every dashboard, notebook, and Genie question follows it.',
      },
      {
        title: 'Evidence of what is enforced',
        body:
          'You can list the policies, filters, and masks in force and test them as the people they target. Auditors get an answer from the catalog. ABAC on views and metastore scope are in beta.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Lead with ABAC.',
      body: 'One policy on a catalog or schema covers every table and column that carries the governed tag, including tables created later.',
    },
    {
      title: 'Tags are the control surface.',
      body: 'Use governed tags with fixed values, and restrict who can assign them. Changing a tag changes which policies apply.',
    },
    {
      title: 'Keep table-level functions for one-off rules.',
      body: 'A row filter or column mask set with ALTER TABLE suits logic that belongs to a single table, such as a mapping-table lookup.',
    },
    {
      title: 'Check groups with is_account_group_member().',
      body: 'It tests account-level groups, which are the ones Unity Catalog grants to. is_member() also sees workspace-local groups, so prefer the account-level function.',
    },
    {
      title: 'Keep policy functions simple.',
      body: 'Use SQL functions, small lookup tables, and a few reusable masks. Complex UDFs slow every query on the table.',
    },
  ],
  sections: [
    {
      id: 'abac',
      heading: 'ABAC policies with governed tags',
      prose:
        'Define the rule once, then let tags decide where it applies. A policy names the function, who it applies to (TO), who is exempt (EXCEPT), and which tables and columns it matches by tag.',
      diagram: {
        type: 'flow',
        title: 'One policy, many tables',
        description:
          'A steward defines a governed tag and assigns it to columns, by hand or from data classification. A single ABAC policy at the catalog or schema matches columns by that tag. Every table and every future table with a tagged column is masked for the principals in the policy, and principals in EXCEPT see real values. Supported external engines get the same enforcement through serverless compute.',
        nodes: [
          { id: 'tag', label: 'Governed tag', sub: 'class = email', col: 0, row: 0, kind: 'highlight' },
          { id: 'cols', label: 'Tagged columns', sub: 'any table in scope', col: 1, row: 0, kind: 'store' },
          { id: 'pol', label: 'One ABAC policy', sub: 'catalog or schema', col: 1, row: 1, kind: 'gate' },
          { id: 'fn', label: 'SQL mask function', sub: 'reused across tables', col: 0, row: 1 },
          { id: 'res', label: 'Enforced at query', sub: 'SQL and external engines', col: 2, row: 1, kind: 'surface' },
        ],
        edges: [
          { from: 'tag', to: 'cols' },
          { from: 'cols', to: 'pol', label: 'matched by tag' },
          { from: 'fn', to: 'pol' },
          { from: 'pol', to: 'res' },
        ],
        legend: [
          { kind: 'highlight', label: 'Governed tag' },
          { kind: 'gate', label: 'Policy' },
          { kind: 'surface', label: 'Enforcement' },
        ],
      },
      examples: [
        {
          label: 'Mask every column tagged class=email, and filter rows by a region tag',
          language: 'sql',
          code: `CREATE OR REPLACE FUNCTION prod.governance.mask_email(v STRING) RETURNS STRING
  RETURN concat(left(v, 1), '***@', split_part(v, '@', 2));

CREATE OR REPLACE POLICY mask_email ON CATALOG prod
  COLUMN MASK prod.governance.mask_email
  TO \`account users\` EXCEPT \`pii-readers\`
  FOR TABLES
  MATCH COLUMNS has_tag_value('class', 'email') AS c
  ON COLUMN c;

CREATE OR REPLACE FUNCTION prod.governance.region_ok(r STRING) RETURNS BOOLEAN
  RETURN EXISTS (SELECT 1 FROM prod.governance.region_access a
                 WHERE a.principal = current_user() AND a.region = r);

CREATE OR REPLACE POLICY region_rows ON SCHEMA prod.sales
  ROW FILTER prod.governance.region_ok
  TO \`account users\` EXCEPT \`sales-global\`
  FOR TABLES
  MATCH COLUMNS has_tag('region') AS r
  USING COLUMNS (r);`,
          notes: [
            'The policy needs MANAGE on the catalog or schema (or ownership) and EXECUTE on the function.',
            'Governed tags must exist and be assigned before the policy matches anything. A tag change can take a few minutes to take effect.',
          ],
        },
      ],
      points: [
        {
          strong: 'Attach at the highest useful scope.',
          text: 'Catalog or schema, not table. Policies at a parent apply to all matching tables beneath it, and a metastore-level scope is in beta for rules that must span catalogs.',
        },
        {
          strong: 'Start small.',
          text: 'A few broad policies such as PII masking and regional row filtering beat one policy per edge case. Consolidate overlaps.',
        },
        {
          strong: 'Fail closed.',
          text: 'Tag new objects with a restrictive default until a steward reviews them, and write a policy that limits access to that default tag.',
        },
      ],
      links: [
        {
          label: 'Attribute-based access control',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
        },
        {
          label: 'Create and manage row filter and column mask policies',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/policies',
        },
        {
          label: 'Best practices for ABAC policies',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/best-practices',
        },
        {
          label: 'CREATE POLICY',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-policy',
        },
      ],
    },
    {
      id: 'classification',
      heading: 'Find sensitive columns with data classification',
      prose:
        'Policies only protect columns that are tagged, so tag them systematically. Data classification scans enabled catalogs, detects sensitive classes such as email addresses and national IDs, and can apply governed tags automatically. Review the results and correct them, then let the ABAC policies act on the tags.',
      points: [
        {
          strong: 'Permissions.',
          text: 'Enabling classification needs ownership or MANAGE on the catalog. Automatic tagging also needs APPLY TAG on the catalog and ASSIGN on each tag.',
        },
        {
          strong: 'Results.',
          text: 'Detections are stored in system.data_classification.results, which you can query for coverage.',
        },
        {
          strong: 'Do not use AI-written comments for this.',
          text: 'Comment generation reads schema names, not data, and is not a PII detector.',
        },
      ],
      links: [
        {
          label: 'Data classification',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification',
        },
      ],
    },
    {
      id: 'table-functions',
      heading: 'Per-table row filters and column masks',
      prose:
        'Attach a SQL function directly to a table when the rule is specific to it. This is the original mechanism, and it still fits a rule with its own lookup, such as a per-table entitlement map.',
      examples: [
        {
          label: 'Attach and remove a mask and a row filter',
          language: 'sql',
          code: `CREATE OR REPLACE FUNCTION main.sales.mask_email(v STRING) RETURNS STRING
  RETURN CASE WHEN is_account_group_member('pii_readers') THEN v
              ELSE concat(left(v, 1), '***@', split_part(v, '@', 2)) END;
ALTER TABLE main.sales.customers ALTER COLUMN email SET MASK main.sales.mask_email;

CREATE OR REPLACE FUNCTION main.sales.region_filter(region STRING) RETURNS BOOLEAN
  RETURN is_account_group_member('admins')
      OR EXISTS (SELECT 1 FROM main.sales.region_access a
                 WHERE a.principal = current_user() AND a.region = region);
ALTER TABLE main.sales.orders SET ROW FILTER main.sales.region_filter ON (region);

-- Detach
ALTER TABLE main.sales.customers ALTER COLUMN email DROP MASK;
ALTER TABLE main.sales.orders DROP ROW FILTER;`,
          notes: [
            'The mapping table makes access a data change: add or remove a row in region_access, and the function does not change.',
            'Keep the mapping table small so the engine can broadcast it.',
          ],
        },
      ],
      points: [
        {
          strong: 'is_account_group_member().',
          text: 'Use it for group checks in policy functions. is_member() also matches workspace-local groups, which are not Unity Catalog principals, and Databricks recommends the account-level function in most cases.',
        },
        {
          strong: 'When to choose which.',
          text: 'Prefer ABAC for rules that follow a classification across tables. Use a table function when the rule belongs to one table, or when you need logic that tags cannot express.',
        },
        {
          strong: 'Sharing.',
          text: 'OpenSharing skips tables that have row filters or column masks. Share a view of the rows and columns the recipient should see.',
        },
      ],
      links: [
        {
          label: 'Row filters and column masks',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/',
        },
        {
          label: 'Manually apply row filters and column masks',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/manually-apply',
        },
        {
          label: 'is_account_group_member',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/is_account_group_member',
        },
      ],
    },
    {
      id: 'limits',
      heading: 'Limits and performance',
      table: {
        caption: 'Current limits and requirements for ABAC row filter and column mask policies',
        columns: ['Topic', 'What to know'],
        rows: [
          [
            'Compute',
            'Serverless, standard compute on Databricks Runtime 16.4 or above, or dedicated compute on 16.4 or above with fine-grained access control. Older runtimes cannot read ABAC-secured tables.',
          ],
          [
            'Quotas',
            'Policies per catalog: 100. Per schema: 100. Per table: 50. Principals per policy: 20. Column conditions per MATCH COLUMNS: 6 for row filters and 3 for column masks.',
          ],
          ['Tags', 'ABAC uses governed tags only. After you assign or change a tag, allow a few minutes.'],
          [
            'Identity attributes',
            'has_identity_attribute_value() and related functions work in the WHEN clause of column mask policies only, and need SQL to create them.',
          ],
          [
            'Views',
            'ABAC on views is in beta and needs Databricks Runtime 19 or above. Metric views are not supported. CREATE OR REPLACE VIEW drops tags and attached policies, so use ALTER VIEW.',
          ],
          [
            'Performance',
            'Use simple SQL functions, not Python UDFs. Keep lookup tables small enough to broadcast. Reuse the same mask across columns. Avoid regex masking of large text. Policies can limit predicate pushdown, so test with real queries.',
          ],
        ],
      },
      links: [
        {
          label: 'Requirements, quotas, and limitations',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/requirements',
        },
        {
          label: 'Performance considerations',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/performance',
        },
      ],
    },
    {
      id: 'inventory',
      heading: 'List the policies in force',
      prose: 'You can read policies back with SQL, so an inventory is a query, not a document that goes stale.',
      examples: [
        {
          label: 'ABAC policies, table-level masks and filters, and a policy gap check',
          language: 'sql',
          code: `-- ABAC policies across the metastore (needs MANAGE on where the policy is attached)
SELECT * FROM system.information_schema.abac_policy_definitions
ORDER BY policy_name;

-- Policies on one table, including inherited ones
SHOW EFFECTIVE POLICIES ON TABLE prod.sales.customers;

-- Table-level masks and filters in a catalog
SELECT table_name, column_name, mask_name FROM prod.information_schema.column_masks;
SELECT table_name, filter_name, target_columns FROM prod.information_schema.row_filters;`,
          notes: [
            'The gap to look for is a sensitive column with no policy. Compare tagged columns in information_schema.column_tags against the policies that cover them.',
          ],
        },
      ],
    },
    {
      id: 'testing',
      heading: 'Test as the people the policy targets',
      points: [
        {
          strong: 'Use a real member of the target group.',
          text: 'Owners, admins, and principals in an EXCEPT list bypass the policy, so their results prove nothing. Run the same queries as a user or service principal that the policy covers, and compare.',
        },
        {
          strong: 'Check both sides.',
          text: 'Confirm the covered principal sees masked values and fewer rows, and the exempt principal sees real data.',
        },
        {
          strong: 'Audit tag and policy changes.',
          text: 'Tag edits change what is protected. Review them in system.access.audit.',
        },
      ],
    },
  ],
  related: [
    { slug: 'access-management', title: 'Access management' },
    { slug: 'data-sharing', title: 'Governed data sharing' },
    { slug: 'documentation-generation', title: 'Automated data documentation' },
  ],
};
