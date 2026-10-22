import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'row-column-security',
  area: 'Governance/Monitoring',
  title: 'Row and column security',
  intro:
    'Row filters hide rows and column masks rewrite values, both enforced by Unity Catalog at query time. Grants decide who can read a table, and these tools decide what a reader sees inside it. The current pattern is attribute-based access control (ABAC): tag the data with governed tags and write one policy per tag. ABAC policies are generally available and, with cross-engine ABAC, also apply when supported external engines read your managed tables. Per-table filter and mask functions remain the right tool for a rule that belongs to one table. This page compares the four approaches, then covers ABAC, data classification, a masking pattern library, row-level patterns, how filters and masks behave with sharing and other engines, the limits that matter, and how to list what is in force.',
  businessValue: {
    summary:
      'Compliance and data owners need sensitive rows and values hidden from people who should not see them, without a copy per audience. Pick between grants, ABAC policies, table-level filters and masks, and dynamic views, then apply tested masking and row-filter patterns.',
    outcomes: [
      {
        title: 'PII masked at query time',
        body: 'Column masks rewrite values for people without the right group membership. Analysts keep working on the same table and see masked values, so no separate redacted copy exists. Pick partial, hashed, or null per column.',
      },
      {
        title: 'One policy covers new tables',
        body: 'An ABAC policy on a catalog or schema applies to every table or column with the governed tag, including tables created later. Coverage does not depend on someone remembering to add a rule.',
      },
      {
        title: 'Regional or team data separation',
        body: 'Row filters show each group only its own rows, such as one region or business unit. The rule lives on the data, so every dashboard, notebook, and Genie question follows it.',
      },
      {
        title: 'Evidence of what is enforced',
        body: 'You can list the policies, filters, and masks in force and test them as the people they target. Auditors get an answer from the catalog. ABAC on views and metastore scope are in beta.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Pick the mechanism first.',
      body: 'Grants decide who may read a table. ABAC covers a rule that follows a classification. A table-level function fits one table. A dynamic view fits sharing or hiding the base table.',
    },
    {
      title: 'RBAC and ABAC stack.',
      body: 'A reader needs the grant first, then the policy shapes what the reader sees. The access-management guide covers the grants.',
    },
    {
      title: 'Lead with ABAC.',
      body: 'One policy on a catalog or schema covers every table and column that carries the governed tag, including tables created later.',
    },
    {
      title: 'Match the mask to the use.',
      body: 'Partial mask for values people read, salted hash for keys people join on, typed NULL for the rest. Wrap each in a group check so stewards see real values.',
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
    {
      title: 'Check sharing and engines before you rely on it.',
      body: 'A table with a table-level filter or mask cannot be shared. A policy does not travel with a share. Cross-engine ABAC covers managed tables for reads only.',
    },
  ],
  sections: [
    {
      id: 'choose-approach',
      heading:
        'Choose an approach: RBAC grants, ABAC policies, per-table row filters and column masks, or dynamic views',
      prose:
        'Four mechanisms decide who sees what. Grants decide who can read a table at all. The other three change what a reader sees inside it. Pick by how many tables the rule covers and whether the rule follows a classification, then check the compute and sharing limits in the matrix.',
      diagram: {
        type: 'matrix',
        title: 'Four ways to limit access, side by side',
        description:
          'RBAC grants apply to a securable and are checked for every query. ABAC policies match columns by governed tag at a catalog, schema or table, need governed tags, and run on serverless or Databricks Runtime 16.4 and above. Table-level filters and masks are a function on one table, need no tags, and run on Databricks Runtime 12.2 LTS and above; the provider cannot share the table. Dynamic views are SQL in a view, need no tags, and can be shared, but cross-engine ABAC does not support them.',
        corner: 'Property ↓ · Approach →',
        columns: ['RBAC grants', 'ABAC policy', 'Table filter or mask', 'Dynamic view'],
        rows: [
          {
            label: 'Scope',
            cells: [
              { state: 'optional', text: 'Securable', sub: 'catalog, schema, table' },
              {
                state: 'own',
                text: 'Every tagged column',
                sub: 'catalog, schema, table',
                detail:
                  'A policy at a catalog or schema matches tagged columns in every table beneath it, including later tables. A metastore-level scope is in beta (September 17, 2026).',
              },
              { state: 'optional', text: 'One table' },
              { state: 'optional', text: 'One view' },
            ],
          },
          {
            label: 'Where the rule lives',
            cells: [
              { state: 'optional', text: 'Grants', sub: 'to account groups' },
              { state: 'own', text: 'Policy plus tag', sub: 'function reused' },
              { state: 'optional', text: 'Function on table', sub: 'owner manages it' },
              { state: 'optional', text: 'View SQL', sub: 'second object' },
            ],
          },
          {
            label: 'Needs governed tags',
            cells: [
              { state: 'none', text: 'No' },
              {
                state: 'own',
                text: 'Yes',
                sub: 'governed only',
                detail: 'ABAC uses governed tags only. After you assign or change a tag, allow a few minutes.',
              },
              { state: 'none', text: 'No' },
              { state: 'none', text: 'No' },
            ],
          },
          {
            label: 'Runtime and serverless',
            cells: [
              { state: 'optional', text: 'Unity Catalog compute' },
              {
                state: 'optional',
                text: 'Serverless or 16.4+',
                sub: 'views need 19+',
                detail:
                  'Serverless, standard compute on Databricks Runtime 16.4 or above, or dedicated compute on 16.4 or above with fine-grained access control. ABAC on views is in beta and needs Databricks Runtime 19 or above.',
              },
              {
                state: 'optional',
                text: 'DBR 12.2 LTS+',
                sub: 'dedicated: 15.4 LTS+',
                detail:
                  'Databricks Runtime below 12.2 LTS does not support them. Dedicated compute needs 15.4 LTS or above to read and 16.3 or above to write.',
              },
              { state: 'optional', text: 'Same as any view' },
            ],
          },
          {
            label: 'OpenSharing',
            cells: [
              { state: 'optional', text: 'Share grants' },
              {
                state: 'optional',
                text: 'Owner must be exempt',
                sub: 'recipient gets raw data',
                detail:
                  'A share owner who is in the EXCEPT clause can share the table. The provider policy does not restrict the recipient.',
              },
              { state: 'none', text: 'Cannot share' },
              { state: 'own', text: 'Share the view' },
            ],
          },
          {
            label: 'Outside engines',
            cells: [
              { state: 'optional', text: 'Per grants' },
              {
                state: 'own',
                text: 'Cross-engine, GA',
                sub: 'managed tables, reads',
                detail:
                  'Cross-engine ABAC is generally available (October 1, 2026). Supported external engines read Unity Catalog managed tables while Databricks serverless compute enforces the policies.',
              },
              { state: 'optional', text: 'See the interactions section' },
              { state: 'none', text: 'Not supported' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'Strongest fit for the property' },
          { state: 'optional', label: 'Works, with a cost or limit' },
          { state: 'none', label: 'No, or not needed' },
        ],
      },
      options: {
        caption: 'Which mechanism to use',
        rows: [
          {
            option: 'RBAC grants to account groups',
            when: 'The question is who may use the table, and the answer follows a team or an environment.',
            tradeoffs:
              'Scales by inheritance: a grant on a schema covers later tables. Auditable in information_schema and the audit log. It cannot hide a row or mask a value inside a table that someone can read, and it adds no per-row evaluation to a query.',
          },
          {
            option: 'ABAC policy on governed tags',
            when: 'One rule covers many tables, such as mask every email column or hide a region everywhere it appears.',
            tradeoffs:
              'Scales best: one policy covers current and future tagged columns, and supported external engines get the same result. Maintenance moves to tags, which become a security control. Policies have quotas (100 per catalog, 50 per table) and can limit predicate pushdown. Auditable with system.information_schema.abac_policy_definitions.',
          },
          {
            option: 'Table-level row filter or column mask',
            when: 'The rule belongs to one table, or needs a lookup or logic that tag matching cannot express.',
            tradeoffs:
              'Most flexible, since the function holds any SQL. It repeats per table and can drift, one table takes one row filter, and the provider cannot share the table. Time travel is not supported with it. Auditable in information_schema.column_masks and row_filters.',
          },
          {
            option: 'Dynamic view',
            when: 'You publish a subset to people who cannot read the base table, or you share the subset.',
            tradeoffs:
              'Works anywhere a view works, including a share. It is a second object per audience, readers must be denied the base table, and cross-engine ABAC does not support dynamic views. Performance follows the view query.',
          },
        ],
        recommendation:
          'Default to RBAC grants for who may use the data, plus ABAC for rules that follow a classification. Add a table-level function for the one-table exception, and a dynamic view only to share or to hide the base table.',
      },
      points: [
        {
          strong: 'RBAC versus ABAC.',
          text: 'RBAC answers whether a principal may touch an object. ABAC answers what the principal sees in it, by matching tags on columns and tables. They stack: a reader needs the grant first, then the policy shapes the result.',
        },
        {
          strong: 'Do not stack two rules on one column.',
          text: 'Only one distinct mask or filter can apply to a principal on a column, and a conflict raises an error. Pick one owner per column.',
        },
        {
          strong: 'The access-management guide covers the grants side.',
          text: 'Account groups, inheritance and audit live there. This page covers what happens inside the table.',
        },
      ],
      links: [
        {
          label: 'Row filters and column masks',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/',
        },
        {
          label: 'Attribute-based access control',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
        },
        { label: 'Dynamic views', url: 'https://docs.databricks.com/aws/en/views/dynamic' },
      ],
    },
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
          {
            id: 'tag',
            label: 'Governed tag',
            sub: 'class = email',
            col: 0,
            row: 0,
            kind: 'highlight',
            icon: 'checklist',
            domain: 'governance',
            detail:
              'A governed tag, such as class = email, that a steward assigns to columns by hand or from data classification.',
          },
          {
            id: 'cols',
            label: 'Tagged columns',
            sub: 'any table in scope',
            col: 1,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'governance',
            detail: 'Columns that carry the tag, in any table in scope.',
          },
          {
            id: 'pol',
            label: 'One ABAC policy',
            sub: 'catalog or schema',
            col: 1,
            row: 1,
            kind: 'gate',
            domain: 'governance',
            detail:
              'One ABAC policy at the catalog or schema level. It matches columns by tag and covers future tables with tagged columns.',
          },
          {
            id: 'fn',
            label: 'SQL mask function',
            sub: 'reused across tables',
            col: 0,
            row: 1,
            icon: 'gear-data',
            domain: 'governance',
            detail: 'A SQL mask function that the policy applies. The same function is reused across tables.',
          },
          {
            id: 'res',
            label: 'Enforced at query',
            sub: 'SQL and external engines',
            col: 2,
            row: 1,
            kind: 'surface',
            icon: 'warehouse',
            domain: 'governance',
            detail:
              'The policy applies when a query runs. Principals in the policy see masked values, and those in EXCEPT see real values.',
          },
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

CREATE OR REPLACE FUNCTION prod.governance.region_ok(region_value STRING) RETURNS BOOLEAN
  RETURN EXISTS (SELECT 1 FROM prod.governance.region_access a
                 WHERE a.principal = current_user() AND a.region = region_value);

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
        'Attach a SQL function directly to a table when the rule is specific to it. This is the original mechanism, and it still fits a rule with its own lookup, such as a per-table entitlement map. The first section compares it with the other approaches.',
      examples: [
        {
          label: 'Attach and remove a mask and a row filter',
          language: 'sql',
          code: `CREATE OR REPLACE FUNCTION main.sales.mask_email(v STRING) RETURNS STRING
  RETURN CASE WHEN is_account_group_member('pii_readers') THEN v
              ELSE concat(left(v, 1), '***@', split_part(v, '@', 2)) END;
ALTER TABLE main.sales.customers ALTER COLUMN email SET MASK main.sales.mask_email;

CREATE OR REPLACE FUNCTION main.sales.region_filter(region_value STRING) RETURNS BOOLEAN
  RETURN is_account_group_member('admins')
      OR EXISTS (SELECT 1 FROM main.sales.region_access a
                 WHERE a.principal = current_user() AND a.region = region_value);
ALTER TABLE main.sales.orders SET ROW FILTER main.sales.region_filter ON (region);

-- Detach
ALTER TABLE main.sales.customers ALTER COLUMN email DROP MASK;
ALTER TABLE main.sales.orders DROP ROW FILTER;`,
          notes: [
            'The mapping table makes access a data change: add or remove a row in region_access, and the function does not change.',
            'Keep the mapping table small so the engine can broadcast it.',
            'The function parameter is region_value, not region. Inside the subquery, an unqualified region would resolve to the mapping table column.',
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
          text: 'The comparison in the first section has the defaults. Use a table function when the rule belongs to one table, or when you need logic that tags cannot express.',
        },
        {
          strong: 'Sharing.',
          text: 'A provider cannot share a table with a table-level row filter or column mask. Share a view of the rows and columns the recipient should see.',
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
        { label: 'Dynamic views', url: 'https://docs.databricks.com/aws/en/views/dynamic' },
      ],
    },
    {
      id: 'mask-patterns',
      heading: 'Masking pattern library',
      prose:
        'Each pattern below is a SQL function plus the statement that attaches it. The table-level form uses ALTER TABLE ... SET MASK. The ABAC form uses CREATE POLICY ... COLUMN MASK and matches columns by tag. The function is the same in both, so write it once and choose the attachment by how many tables need it. A mask function takes the column value as its first argument and must return the same type, or a type that casts back to the column type.',
      options: {
        caption: 'Which masking pattern for which column',
        rows: [
          {
            option: 'Partial mask (last four)',
            when: 'People need to recognize a value, such as a card or national ID, without reading it.',
            tradeoffs:
              'Cheap to evaluate and keeps the length. It leaks the digits it shows, so show as few as the task needs. Cannot be joined on, because masked values collide.',
          },
          {
            option: 'Salted hash (sha2)',
            when: 'Analysts must join or count distinct on a key without seeing it.',
            tradeoffs:
              'One-way and stable, so the same input gives the same output in every table that uses the same salt. A low-entropy input such as a phone number or national ID can be recovered by hashing every candidate, so keep the salt secret and rotate it with a version argument. The salt sits in the function body, and anyone who can read the function can read it.',
          },
          {
            option: 'Tokenize with a lookup table',
            when: 'Authorized people must get the original value back.',
            tradeoffs:
              'Reversible by design, since the mapping table holds the original. The table becomes the crown jewel: govern it with its own grants and keep it small enough to broadcast. Databricks documents no built-in tokenization service, so this is a pattern you build.',
          },
          {
            option: 'Null out or constant',
            when: 'Nobody outside a group needs the column at all.',
            tradeoffs:
              'Strongest and cheapest. Downstream logic that assumed a value breaks or skews, so return a typed NULL and tell consumers.',
          },
          {
            option: 'Type-safe generalization',
            when: 'Numbers and dates must stay usable in aggregates, such as salary bands or birth year.',
            tradeoffs:
              'Keeps the column type, so queries and BI tools keep working. Precision is lost on purpose; choose the bucket so small groups cannot be singled out.',
          },
        ],
        recommendation:
          'Default to a partial mask for identifiers people read, a salted hash for keys people join on, and a typed NULL for everything else. Wrap any of them in a group check so stewards see real values.',
      },
      examples: [
        {
          label: 'Partial mask: last four, with the count passed as a constant',
          language: 'sql',
          code: `CREATE OR REPLACE FUNCTION main.sales.mask_last_n(v STRING, n INT) RETURNS STRING DETERMINISTIC
  RETURN concat(repeat('*', greatest(length(v) - n, 0)), right(v, n));

-- One table
ALTER TABLE main.sales.customers ALTER COLUMN card_number
  SET MASK main.sales.mask_last_n USING COLUMNS (4);

-- Every column tagged class = card in the schema
CREATE OR REPLACE POLICY mask_card ON SCHEMA main.sales
  COLUMN MASK main.sales.mask_last_n
  TO \`account users\` EXCEPT \`pii-readers\`
  FOR TABLES
  MATCH COLUMNS has_tag_value('class', 'card') AS c
  ON COLUMN c
  USING COLUMNS (4);`,
          notes: [
            'USING COLUMNS takes column aliases or constant literals. SET MASK and CREATE POLICY accept the same form.',
            'DETERMINISTIC lets the optimizer run query filters before the mask, as the docs advise for Python functions. Leave it off any function that calls is_account_group_member() or current_user().',
          ],
        },
        {
          label: 'Hash or tokenize: salted sha2, and a reversible lookup',
          language: 'sql',
          code: `-- One-way. Replace the salt literal with your own. The value is visible to anyone who can read the function.
CREATE OR REPLACE FUNCTION main.sales.hash_email(v STRING) RETURNS STRING DETERMINISTIC
  RETURN sha2(concat(v, '<salt>'), 256);
ALTER TABLE main.sales.customers ALTER COLUMN email SET MASK main.sales.hash_email;

-- Tag-driven, with a version argument so you can rotate the hash later
CREATE OR REPLACE FUNCTION main.sales.pseudonymize(val STRING, version INT) RETURNS STRING DETERMINISTIC
  RETURN sha2(concat(val, CAST(version AS STRING)), 256);
CREATE OR REPLACE POLICY hash_ids ON SCHEMA main.sales
  COLUMN MASK main.sales.pseudonymize
  TO \`account users\` EXCEPT \`pii-readers\`
  FOR TABLES
  MATCH COLUMNS has_tag_value('class', 'join_key') AS c
  ON COLUMN c
  USING COLUMNS (1);

-- Reversible: swap the value for a token and keep the original in a locked-down table
CREATE OR REPLACE FUNCTION main.sales.detokenize(tok STRING) RETURNS STRING
  RETURN IF(is_account_group_member('pii-readers'),
            (SELECT t.original FROM main.vault.tokens t WHERE t.token = tok),
            tok);`,
          notes: [
            'sha2 takes a STRING or BINARY and a bit length of 0, 224, 256, 384 or 512. 0 means 256.',
            'secret(scope, key) reads a secret in SQL. The docs do not say whose permissions apply when a mask function calls it, so this page bakes the salt into the function and does not claim secret() works inside a mask.',
            'The tokenize function is a pattern, not a documented feature. The lookup table must not carry its own filter or mask, because a mask function cannot reference a table that has active filters or masks.',
          ],
        },
        {
          label: 'Null out and role-aware masks',
          language: 'sql',
          code: `CREATE OR REPLACE FUNCTION main.sales.null_out(v STRING) RETURNS STRING DETERMINISTIC
  RETURN CAST(NULL AS STRING);
ALTER TABLE main.sales.customers ALTER COLUMN home_address SET MASK main.sales.null_out;

-- Group decides: real value for the group, last four for everyone else
CREATE OR REPLACE FUNCTION main.sales.mask_ssn(v STRING) RETURNS STRING
  RETURN CASE WHEN is_account_group_member('pii-readers') THEN v
              ELSE concat('***-**-', right(v, 4)) END;
ALTER TABLE main.sales.customers ALTER COLUMN ssn SET MASK main.sales.mask_ssn;

-- Identity decides: the user named in the row, or the group, sees the real email
CREATE OR REPLACE FUNCTION main.sales.mask_email_self(v STRING, owner_email STRING) RETURNS STRING
  RETURN IF(current_user() = owner_email OR is_account_group_member('pii-readers'), v, '***');
ALTER TABLE main.sales.customers ALTER COLUMN email
  SET MASK main.sales.mask_email_self USING COLUMNS (owner_email);`,
          notes: [
            'is_account_group_member(group) is true when the session user is a direct or indirect member of the account-level group. Use it instead of is_member(), which also matches workspace-local groups.',
            'With ABAC, put the group in TO and EXCEPT and keep the function free of identity checks. Use the function-level check for table-level masks.',
            'Owners and principals in EXCEPT bypass a policy, so test as a user the policy covers.',
          ],
        },
        {
          label: 'Format-preserving and type-safe masks',
          language: 'sql',
          code: `-- Keep punctuation and length: star the digits except the last four
CREATE OR REPLACE FUNCTION main.sales.mask_phone(v STRING) RETURNS STRING DETERMINISTIC
  RETURN concat(mask(left(v, greatest(length(v) - 4, 0)), NULL, NULL, '*', NULL), right(v, 4));
ALTER TABLE main.sales.customers ALTER COLUMN phone SET MASK main.sales.mask_phone;

-- Keep the column type: DECIMAL stays DECIMAL, DATE stays DATE
CREATE OR REPLACE FUNCTION main.sales.bucket_salary(v DECIMAL(12,2)) RETURNS DECIMAL(12,2)
  RETURN IF(is_account_group_member('hr'), v, round(v, -4));
ALTER TABLE main.sales.customers ALTER COLUMN salary SET MASK main.sales.bucket_salary;

CREATE OR REPLACE FUNCTION main.sales.year_only(v DATE) RETURNS DATE
  RETURN IF(is_account_group_member('hr'), v, make_date(year(v), 1, 1));
ALTER TABLE main.sales.customers ALTER COLUMN birth_date SET MASK main.sales.year_only;`,
          notes: [
            'mask(str, upperChar, lowerChar, digitChar, otherChar) defaults to X, x, n and NULL. A NULL argument leaves that character class unmasked.',
            'The docs describe no format-preserving encryption. mask() keeps the shape of the value and does not make it reversible.',
            'Parameter types must match the column type. With ANSI mode off, an implicit cast can silently become NULL and filter the wrong rows.',
          ],
        },
        {
          label: 'Masking STRUCT and VARIANT columns',
          language: 'sql',
          code: `-- Table-level: mask one field inside a STRUCT
CREATE OR REPLACE FUNCTION main.sales.mask_nested(data STRUCT<value: STRING, secret: STRING>)
  RETURN IF(is_account_group_member('privileged_users'), data,
            named_struct('value', data.value, 'secret', 'REDACTED'));

-- ABAC: one VARIANT function masks INT, DOUBLE and DECIMAL columns alike
CREATE OR REPLACE FUNCTION main.sales.mask_numeric(val VARIANT) RETURNS VARIANT DETERMINISTIC
  RETURN 0::VARIANT;
CREATE OR REPLACE POLICY zero_amounts ON SCHEMA main.sales
  COLUMN MASK main.sales.mask_numeric
  TO \`account users\` EXCEPT \`finance\`
  FOR TABLES
  MATCH COLUMNS has_tag_value('class', 'amount') AS c
  ON COLUMN c;`,
          notes: [
            'In an ABAC mask, Databricks converts the column to VARIANT, runs the function, and casts the result back to the column type. Every returned value must cast back.',
            'Integer types appear as BIGINT inside a VARIANT when you branch on schema_of_variant().',
            'STRUCT support in this form needs Databricks Runtime 18.1 or above. ARRAY and MAP need Databricks Runtime 19 or above (release note of September 16, 2026).',
            'The docs show no pattern for masking one key inside a JSON string. Parse it to a STRUCT or VARIANT column first. A VARIANT column used in a cross-engine query cannot be projected.',
          ],
        },
      ],
      links: [
        {
          label: 'Common ABAC patterns',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/common-patterns',
        },
        {
          label: 'Manually apply row filters and column masks',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/manually-apply',
        },
        { label: 'sha2', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/sha2' },
        { label: 'mask', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/mask' },
        { label: 'secret', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/secret' },
      ],
    },
    {
      id: 'row-patterns',
      heading: 'Row-level patterns',
      prose:
        'A row filter function returns a boolean for each row, and the table keeps the rows where it returns true. The three patterns differ in where the access list lives.',
      options: {
        caption: 'Where the row access list lives',
        rows: [
          {
            option: 'Group-based filter',
            when: 'A few fixed audiences, such as one group per region plus a global group.',
            tradeoffs:
              'No lookup, so it is the cheapest to evaluate. Every new region means editing the function, and the group names sit in code.',
          },
          {
            option: 'Mapping table',
            when: 'Many principals or tenants, or access that changes weekly.',
            tradeoffs:
              'Access is a data change: insert or delete a row, and the function stays the same. The join costs a little on every query, so keep the table small enough to broadcast. The mapping table cannot itself carry a row filter or column mask.',
          },
          {
            option: 'Tag-driven ABAC row filter',
            when: 'The same filter applies to every table that has a region or tenant column.',
            tradeoffs:
              'One policy, many tables, and new tables are covered. A row filter policy allows up to 6 column conditions, and policies can limit predicate pushdown.',
          },
        ],
        recommendation:
          'Start with a mapping table when people change often, a group-based function when the audiences are fixed, and move the same function behind an ABAC policy once three or more tables share the rule.',
      },
      examples: [
        {
          label: 'Mapping-table filter, group filter, and the ABAC form',
          language: 'sql',
          code: `-- Mapping table: principal, region. The parameter is not named region, because inside the
-- subquery an unqualified region would resolve to the mapping table column.
CREATE OR REPLACE FUNCTION main.sales.region_ok(region_value STRING) RETURNS BOOLEAN
  RETURN is_account_group_member('sales-global')
      OR EXISTS (SELECT 1 FROM main.sales.region_access a
                 WHERE a.principal = current_user() AND a.region = region_value);
ALTER TABLE main.sales.orders SET ROW FILTER main.sales.region_ok ON (region);

-- Group-based: no lookup
CREATE OR REPLACE FUNCTION main.sales.region_by_group(region_value STRING) RETURNS BOOLEAN
  RETURN CASE WHEN is_account_group_member('sales-global') THEN true
              WHEN is_account_group_member('sales-emea') THEN region_value = 'EMEA'
              WHEN is_account_group_member('sales-na') THEN region_value = 'NA'
              ELSE false END;

-- Same filter, every table with a column tagged tenant
CREATE OR REPLACE POLICY tenant_rows ON SCHEMA main.sales
  ROW FILTER main.sales.region_ok
  TO \`account users\` EXCEPT \`platform-admins\`
  FOR TABLES
  MATCH COLUMNS has_tag('tenant') AS t
  USING COLUMNS (t);

-- Detach: drop the filter before you drop the function
ALTER TABLE main.sales.orders DROP ROW FILTER;`,
          notes: [
            'A table takes one row filter. Put every rule for the table in one function.',
            'Drop the row filter before you drop its function, or the table is left inaccessible.',
          ],
        },
      ],
      points: [
        {
          strong: 'Keep the function simple.',
          text: 'The docs say the complexity of the function directly affects query performance. Use CASE expressions over a small mapping table.',
        },
        {
          strong: 'Avoid subqueries against large tables.',
          text: 'Complex subqueries or joins against large tables prevent broadcast hash joins and force nested loop joins. If the lookup table is far smaller than the target, the optimizer turns the subquery into a broadcast hash join.',
        },
        {
          strong: 'Stay deterministic and error-safe.',
          text: 'Non-deterministic functions limit what the optimizer can do. Prefer error-safe forms such as try_divide, mark a Python UDF DETERMINISTIC, and prefer SQL functions over Python ones.',
        },
        {
          strong: 'Expect weaker pushdown.',
          text: "The secure view barrier blocks predicates that contain function calls. Filter protected tables with plain comparisons such as WHERE col = 'value' where you can.",
        },
        {
          strong: 'Reuse masks.',
          text: 'One masking function across many columns beats one per column.',
        },
      ],
      links: [
        {
          label: 'Performance considerations',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/performance',
        },
        {
          label: 'Common ABAC patterns',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/common-patterns',
        },
      ],
    },
    {
      id: 'interactions',
      heading: 'How filters and masks behave with sharing, other engines, and downstream tools',
      prose:
        'Where a policy is enforced decides what a reader of a copy, a share, or a derived object sees. This table states what the docs say, with the stage and date where they give one.',
      diagram: {
        type: 'flow',
        title: 'Where each reader meets the policy',
        description:
          'SQL, Genie Agent and dashboard readers query the table through Unity Catalog, which applies the filter or mask for the end user. External engines read through Databricks serverless compute, which enforces the policy and returns sanitized data. An OpenSharing recipient receives data after the share owner, who is exempt from the policy, reads it, so the provider policy does not carry over.',
        nodes: [
          {
            id: 'sql',
            label: 'SQL, Genie, dashboards',
            sub: 'end user identity',
            col: 0,
            row: 0,
            icon: 'users',
            domain: 'data',
            detail:
              'Readers in Databricks SQL, notebooks, Genie Agents and dashboards published with individual data permissions. Unity Catalog evaluates the policy for the end user.',
          },
          {
            id: 'ext',
            label: 'External engine',
            sub: 'Spark over Iceberg REST',
            col: 0,
            row: 1,
            icon: 'cloud-network',
            domain: 'data',
            detail:
              'A supported external engine reading a Unity Catalog managed table. Reads only, with EXTERNAL USE SCHEMA and OAuth M2M or a PAT.',
          },
          {
            id: 'rcp',
            label: 'OpenSharing recipient',
            sub: 'gets the share',
            col: 0,
            row: 2,
            icon: 'data-shares',
            domain: 'data',
            detail:
              'A recipient of a share. The provider policy does not restrict it, so recipients add their own policies on shared tables.',
          },
          {
            id: 'uc',
            label: 'Unity Catalog policy',
            sub: 'filter or mask',
            col: 1,
            row: 0,
            kind: 'gate',
            domain: 'governance',
            detail: 'Row filters, column masks and ABAC policies are evaluated here for the querying principal.',
          },
          {
            id: 'srv',
            label: 'Serverless enforcement',
            sub: 'billed as serverless',
            col: 1,
            row: 1,
            icon: 'gear-data',
            domain: 'governance',
            detail:
              'Databricks serverless compute applies the policies and returns sanitized data to the external engine. Usage appears in system.billing.usage.',
          },
          {
            id: 'own',
            label: 'Share owner reads',
            sub: 'exempt via EXCEPT',
            col: 1,
            row: 2,
            icon: 'id-provider',
            domain: 'governance',
            detail:
              'For a table with ABAC policies, the share owner must be in the EXCEPT clause. The shared data is unfiltered.',
          },
          {
            id: 'tbl',
            label: 'Governed table',
            sub: 'managed, with policies',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail: 'A Unity Catalog table with row filters, column masks or ABAC policies attached.',
          },
        ],
        edges: [
          { from: 'sql', to: 'uc' },
          { from: 'uc', to: 'tbl' },
          { from: 'ext', to: 'srv' },
          { from: 'srv', to: 'tbl' },
          { from: 'rcp', to: 'own' },
          { from: 'own', to: 'tbl', dashed: true },
        ],
        legend: [
          { kind: 'gate', label: 'Policy evaluation' },
          { kind: 'store', label: 'Governed table' },
          { kind: 'dashed', label: 'Policy bypassed by design' },
        ],
      },
      table: {
        caption: 'Behavior by scenario',
        columns: ['Scenario', 'What the docs say'],
        rows: [
          [
            'OpenSharing, provider side',
            'A provider cannot share a table with a table-level row filter or column mask. A table secured by ABAC policies can be shared when the share owner has sharing permission and is exempt through EXCEPT, and then the recipient gets unfiltered data. Since April 23, 2026 the share owner, not the view owner, must be exempt, and customers had until July 22, 2026 to update their EXCEPT clauses. See the data-sharing guide for the stage of ABAC table sharing.',
          ],
          [
            'OpenSharing, recipient side',
            'Recipients can apply row filters, column masks and their own ABAC policies to shared tables and foreign tables. They cannot apply them to shared streaming tables or materialized views, and cannot apply ABAC policies to a shared view. Recipient-side row filters and masks are listed as generally available in the release notes.',
          ],
          [
            'Iceberg REST and external engines',
            'Cross-engine ABAC is generally available (October 1, 2026). Supported external engines read Unity Catalog managed tables with ABAC policies, row filters and column masks enforced by Databricks serverless compute. It needs external data access on the metastore, EXTERNAL USE SCHEMA, a managed table with catalog commits, and OAuth M2M or a PAT. Reads only. The Unity Catalog with an enterprise data management program guide applies ABAC to tagged tables. Dynamic views, VARIANT column projection and BINARY column filtering are not supported. Serverless enforcement is billed.',
          ],
          [
            'Older Iceberg REST note',
            'The row filters and masks limitations page still says you cannot use the Iceberg REST catalog or Unity REST APIs to access tables with row filters or column masks. The cross-engine page and the October 1, 2026 release note are newer. Check the table type and engine against the cross-engine requirements before you rely on either.',
          ],
          [
            'Materialized views and streaming tables',
            'ABAC policies on a materialized view or streaming table are evaluated with the pipeline owner identity, so exempt the owner through EXCEPT. Lakeflow pipelines can create streaming tables and materialized views that use row filters and column masks through the Python API.',
          ],
          [
            'Genie Agents',
            'Row filters and column masks defined in Unity Catalog are enforced per user, and data access runs as the end user, not the author. Apply the protection to the underlying tables rather than in the agent.',
          ],
          [
            'AI/BI dashboards',
            "With shared data permissions, viewers run queries with the publisher's permissions. With individual data permissions, viewers run queries with their own credentials, so their own filters and masks apply. Use individual permissions when the rows or values differ by viewer.",
          ],
          [
            'Change data feed',
            'Automatic change data feed is not supported on tables with row filters or column masks.',
          ],
          [
            'Time travel',
            'Not supported with table-level row filters or column masks. Time travel that enforces ABAC policies is in beta from Databricks Runtime 19 on qualifying managed tables (September 23, 2026).',
          ],
          [
            'Views',
            'You cannot apply a table-level row filter or column mask to a view. ABAC row filters and masks on views are in beta (September 29, 2026), need Databricks Runtime 19 or above, and a workspace admin turns on the ABAC on Views preview.',
          ],
          [
            'Clones and search indexes',
            'Deep and shallow clones are not supported on tables with row filters or column masks. You cannot create an AI Search index from such a table.',
          ],
        ],
      },
      links: [
        {
          label: 'Cross-engine ABAC',
          url: 'https://docs.databricks.com/aws/en/external-access/cross-engine-abac',
        },
        {
          label: 'OpenSharing and ABAC',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/opensharing',
        },
        {
          label: 'Change data feed',
          url: 'https://docs.databricks.com/aws/en/tables/features/change-data-feed',
        },
        {
          label: 'Data access in Genie Agents',
          url: 'https://docs.databricks.com/aws/en/genie-agents/concepts',
        },
        {
          label: 'Share a dashboard',
          url: 'https://docs.databricks.com/aws/en/dashboards/share/share',
        },
        {
          label: 'Release notes, October 2026',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/october',
        },
      ],
    },
    {
      id: 'run-it',
      heading: 'Run the patterns',
      prose:
        'The reference job builds a sample table, applies six of these masks and a mapping-table row filter with ALTER TABLE, queries as the job identity, and checks each value against an independent calculation. It creates no account-level object unless you set abac_mode to governed, which adds one governed tag and one ABAC policy.',
      steps: [
        {
          title: 'Create the salt secret (optional).',
          body: 'Without it the notebook uses a clearly marked demo salt and warns.',
          code: `databricks secrets create-scope rcs-demo
databricks secrets put-secret rcs-demo hash-salt --string-value "$(openssl rand -hex 16)"`,
        },
        {
          title: 'Run the job.',
          body: 'The masking_patterns task is the last of five. Run 05_masking_patterns on its own with Run all, or leave abac_mode at off.',
        },
        {
          title: 'Read rcs_mask_results.',
          body: 'Each row shows the expected and actual value for one pattern, and whether they match.',
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
    { slug: 'unity-catalog-edm', title: 'Unity Catalog with an enterprise data management program' },
    { slug: 'documentation-generation', title: 'Automated data documentation' },
  ],
};
