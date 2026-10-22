import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'documentation-generation',
  area: 'Governance/Monitoring',
  title: 'Automated data documentation',
  intro:
    'Document data where people already look for it: in Unity Catalog. Comments, governed tags, certification, lineage, and quality results are metadata on the table itself, so they show up in Catalog Explorer, in search, and in Genie, and they stay current when the table changes. A wiki page copied out of the catalog goes stale the day after it is written. This page covers what to record, how to draft it with AI without publishing unreviewed text, and which platform features supply the lineage and quality sections.',
  businessValue: {
    summary:
      'Teams stop asking who owns a table or what a column means when the answer sits in Unity Catalog. This guide is for data stewards and CDOs who need documentation that stays current without a wiki project.',
    outcomes: [
      {
        title: 'Documentation that stays current',
        body: 'Comments, governed tags, and certification live on the table in Unity Catalog, so Catalog Explorer, search, and Genie show them. Nothing is copied into a wiki that goes stale after the next schema change.',
      },
      {
        title: 'Faster first drafts, human sign-off',
        body: 'AI drafts table and column comments, and owners approve them. Bulk drafts go to a review table first, and a tag marks AI-written text, so no one publishes unreviewed wording.',
      },
      {
        title: 'Sensitive data is labeled once',
        body: 'Governed tags with fixed values mark sensitive columns. Search and later access policies can rely on those labels because only permitted users can assign them.',
      },
      {
        title: 'Lineage and quality come built in',
        body: 'Lineage and data quality monitoring results come from the platform, so the documentation links to them. Anomaly detection is Public Preview, so confirm its status before you commit to it.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Write documentation into Unity Catalog metadata.',
      body: 'Table and column comments, governed tags, a certification tag, and an owner are the documentation. Lineage and quality come from system features, so you do not write them by hand.',
    },
    {
      title: 'Let AI propose; let owners approve.',
      body: 'Catalog Explorer drafts comments one object at a time. For bulk work, write drafts to a review table and apply only the approved rows.',
    },
    {
      title: 'Never overwrite a human comment.',
      body: 'Fill only empty comments, and mark what AI wrote with a tag so a reviewer can find it later.',
    },
    {
      title: 'Use governed tags for meaning and sensitivity.',
      body: 'Governed tags have a fixed set of allowed values and controlled permissions. Policies and search can rely on them in a way they cannot rely on free-form tags.',
    },
    {
      title: 'Take quality from data quality monitoring.',
      body: 'Freshness, completeness, and profile metrics already live in Unity Catalog. Link to them from the documentation instead of recomputing them.',
    },
  ],
  sections: [
    {
      id: 'what-to-record',
      heading: 'What to record on a table',
      prose:
        'Each item below has one home in Unity Catalog. Documentation tooling should read and write those homes rather than keep a parallel copy.',
      table: {
        columns: ['Item', 'Where it lives'],
        rows: [
          [
            'What the table is and what each column means',
            'Table and column comments (COMMENT ON, or ALTER TABLE ... ALTER COLUMN ... COMMENT)',
          ],
          ['Domain, owner team, data product', 'Governed tags, or Unity Catalog tags when the value is free text'],
          ['Sensitivity and PII', 'Governed tags, set by data classification and reviewed by a steward'],
          ['Trusted or retired', 'The system.certification_status tag with the value certified or deprecated'],
          [
            'Where it comes from and who reads it',
            'Lineage: system.access.table_lineage, system.access.column_lineage, and the Lineage tab',
          ],
          ['How fresh and complete it is', 'Data quality monitoring (anomaly detection, data profiling)'],
          ['Who owns it', 'The object owner; set it to a group or a service principal, not to a person'],
        ],
      },
      links: [
        {
          label: 'Add comments to Unity Catalog objects',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-comment',
        },
        {
          label: 'Apply tags to Unity Catalog securable objects',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/tags',
        },
        {
          label: 'Flag data as certified or deprecated',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data',
        },
        {
          label: 'Data lineage',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage',
        },
      ],
    },
    {
      id: 'ai-comments',
      heading: 'Start with AI-generated comments in Catalog Explorer',
      prose:
        'For a handful of tables, the built-in feature is enough. Open the table in Catalog Explorer and select AI generate. Databricks drafts a description from the schema and column names, and the owner accepts or edits it. There is no workspace setting to turn on, and nothing is saved until someone accepts.',
      points: [
        {
          strong: 'Who can save.',
          text: 'The object owner or a user with MODIFY can save a comment on most objects. Views and materialized views need the owner.',
        },
        {
          strong: 'Saving runs an ALTER.',
          text: 'A saved comment is a DDL change. Apply it outside a running pipeline or job that depends on the table.',
        },
        {
          strong: 'Review every draft.',
          text: 'The model sees the schema, not the data. Do not use it to decide which columns hold PII; use data classification for that.',
        },
        {
          strong: 'Readers need BROWSE.',
          text: 'BROWSE on the catalog lets people read comments and other metadata without USE CATALOG or USE SCHEMA.',
        },
      ],
      links: [
        {
          label: 'AI-generated comments',
          url: 'https://docs.databricks.com/aws/en/comments/ai-comments',
        },
      ],
    },
    {
      id: 'propose-approve',
      heading: 'For bulk drafts, propose first and apply after review',
      prose:
        'When you document hundreds of tables, draft in SQL or a job, but keep drafts out of the catalog until the owner signs off. This keeps the model from publishing a wrong description on a certified table.',
      diagram: {
        type: 'flow',
        title: 'Propose, review, apply',
        description:
          'A job reads table and column metadata, lineage, and profile statistics from Unity Catalog. It asks a model for draft comments and writes them to a proposals table with status proposed. The table owner reviews each row and marks it approved or rejected. A second step applies only approved rows with COMMENT ON, skipping any column that already has a human comment, and sets a tag that marks the comment as AI-drafted.',
        nodes: [
          {
            id: 'meta',
            label: 'Catalog metadata',
            sub: 'schema, lineage, stats',
            col: 0,
            row: 0,
            kind: 'store',
            domain: 'governance',
            icon: 'data-search',
            detail:
              'Table and column metadata, lineage, and profile statistics read from Unity Catalog. The model drafts from this context.',
          },
          {
            id: 'draft',
            label: 'Draft with ai_gen',
            sub: 'or ai_query',
            col: 1,
            row: 0,
            kind: 'highlight',
            domain: 'ai',
            icon: 'gear-maroon',
            detail:
              'A job asks a model, through ai_gen or ai_query, for draft table and column comments. Nothing is published at this step.',
          },
          {
            id: 'prop',
            label: 'Proposals table',
            sub: 'status = proposed',
            col: 2,
            row: 0,
            kind: 'store',
            domain: 'data',
            icon: 'database',
            detail:
              'Holds drafts with status proposed. Keys of table, column, and metadata hash let a rerun update pending rows and leave decided ones alone.',
          },
          {
            id: 'review',
            label: 'Owner review',
            sub: 'approve or reject',
            col: 2,
            row: 1,
            kind: 'gate',
            domain: 'governance',
            detail:
              'The table owner marks each proposed row approved or rejected, so the model cannot publish a wrong description on a certified table.',
          },
          {
            id: 'apply',
            label: 'Apply COMMENT ON',
            sub: 'approved rows only',
            col: 1,
            row: 1,
            domain: 'orchestration',
            icon: 'gear-amber',
            detail:
              'Runs COMMENT ON for approved rows only. It skips any column with a human comment and tags the comment as AI-drafted.',
          },
          {
            id: 'uc',
            label: 'Unity Catalog',
            sub: 'comments and tags',
            col: 0,
            row: 1,
            kind: 'surface',
            domain: 'governance',
            icon: 'checklist',
            detail: 'Where the comments and tags land, so people find them in Catalog Explorer next to the data.',
          },
        ],
        edges: [
          { from: 'meta', to: 'draft' },
          { from: 'draft', to: 'prop' },
          { from: 'prop', to: 'review' },
          { from: 'review', to: 'apply', label: 'approved' },
          { from: 'apply', to: 'uc' },
        ],
        legend: [
          { kind: 'highlight', label: 'AI step' },
          { kind: 'gate', label: 'Human approval' },
          { kind: 'surface', label: 'Published metadata' },
        ],
      },
      points: [
        {
          strong: 'Fill gaps only.',
          text: 'Skip any column whose comment is not empty. An AI draft never replaces text a person wrote.',
        },
        {
          strong: 'Mark AI text.',
          text: 'Set a tag such as comment_source = ai on columns the job commented, so reviewers and later runs can tell them apart.',
        },
        {
          strong: 'Make the job safe to rerun.',
          text: 'Key proposals by table, column, and metadata hash. A rerun updates a pending row and leaves approved and rejected rows alone.',
        },
        {
          strong: 'Refresh on a trigger.',
          text: 'Run the job on a schedule or when a table changes, and let it propose only for new or changed columns.',
        },
      ],
      examples: [
        {
          label: 'Apply an approved comment only where a human has not written one',
          language: 'sql',
          code: `-- proposals(table_catalog, table_schema, table_name, column_name, draft, status)
-- A job loops over this result. COMMENT ON takes only literals, so it builds one statement per row.
SELECT p.table_catalog, p.table_schema, p.table_name, p.column_name, p.draft
FROM main.docs.comment_proposals p
JOIN main.information_schema.columns c
  ON c.table_schema = p.table_schema
 AND c.table_name = p.table_name
 AND c.column_name = p.column_name
WHERE p.status = 'approved'
  AND (c.comment IS NULL OR c.comment = '');

-- Statements the job runs for each row:
COMMENT ON COLUMN main.sales.orders.order_total IS 'Order value in USD after discounts, before tax.';
ALTER TABLE main.sales.orders ALTER COLUMN order_total SET TAGS ('comment_source' = 'ai');`,
          notes: [
            'Create comment_source as a governed tag if you want to control who can set it.',
            'Join against the information_schema of the catalog that holds the tables. The example assumes one catalog.',
          ],
        },
      ],
    },
    {
      id: 'ai-functions',
      heading: 'ai_gen or ai_query for the drafting step',
      prose:
        'Both run from SQL and are billed per inference. Pick by how much control you need over the model and the output shape.',
      points: [
        {
          strong: 'Ground the prompt.',
          text: 'Pass the table name, column name, data type, neighboring columns, upstream table names from lineage, and a few profile numbers. Do not send raw sample values from sensitive columns.',
        },
        {
          strong: 'Check where data goes.',
          text: 'A Databricks-hosted model keeps the request inside your Databricks geography. An external-model endpoint sends it to that provider under its own terms.',
        },
        {
          strong: 'Draft once.',
          text: 'Write results to the proposals table and read them from there. Do not call the model each time someone opens a dashboard.',
        },
      ],
      options: {
        caption: 'Drafting function for descriptions',
        rows: [
          {
            option: 'ai_gen(prompt)',
            when: 'You want free text from a Databricks-hosted model with no endpoint to name, such as a one-sentence column description.',
            tradeoffs:
              'Least to set up. Public Preview and tuned for English, so check the release notes before you build a pipeline on it. You get free text with no schema, so you parse it yourself. Billed per inference.',
          },
          {
            option: 'ai_query(endpoint, request, ...)',
            when: 'You need a specific model or your own endpoint, a structured result, or per-row error handling.',
            tradeoffs:
              'More arguments and an endpoint name to track. responseFormat returns a JSON schema result you can validate before it reaches the proposals table, and failOnError keeps one bad row from failing a batch. Billed per inference at the rate of the model you pick. An external-model endpoint sends the request to that provider under its terms.',
          },
        ],
        recommendation:
          'Use ai_query with responseFormat for bulk drafting, because a parseable result and failOnError keep bad rows out of the proposals table. Use ai_gen for quick one-off descriptions while you explore.',
      },
      links: [
        { label: 'ai_gen', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_gen' },
        { label: 'ai_query', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query' },
        {
          label: 'AI Functions overview',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions',
        },
        {
          label: 'Query a model with ai_query',
          url: 'https://docs.databricks.com/aws/en/large-language-models/ai-query',
        },
      ],
    },
    {
      id: 'classification',
      heading: 'Classify sensitive columns instead of guessing',
      prose:
        'Data classification scans the catalogs you enable and tags columns that hold PII and other sensitive classes. It writes detections to system.data_classification.results and can apply governed tags automatically. A steward reviews the results, and those tags then drive masking and access policies, so documentation and security share one source.',
      points: [
        {
          strong: 'Enable per catalog.',
          text: 'You need ownership or MANAGE on the catalog. Automatic tagging also needs APPLY TAG on the catalog and ASSIGN on each tag.',
        },
        {
          strong: 'Keep a human in the loop.',
          text: 'Treat detections as proposals, the same as AI comments. Confirm a class before a policy depends on it.',
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
      id: 'quality-lineage',
      heading: 'Quality and lineage come from the platform',
      prose:
        'A documentation page should link to quality and lineage, not restate them. Both are queryable, so a generated page can show current values.',
      table: {
        caption: 'Sources for the quality and lineage sections',
        columns: ['Section', 'Source'],
        rows: [
          [
            'Freshness and completeness',
            'Data quality monitoring anomaly detection. Results land in system.data_quality_monitoring.table_results (Public Preview, kept 13 months).',
          ],
          [
            'Column statistics and drift',
            'Data profiling (formerly Lakehouse Monitoring) writes profile and drift metric tables for tables you choose.',
          ],
          ['Upstream and downstream tables', 'system.access.table_lineage, or the Lineage tab in Catalog Explorer'],
          ['Column-level origin', 'system.access.column_lineage'],
          [
            'Who uses it',
            'system.query.history and the audit log, subject to the retention and masking rules in the observability guide',
          ],
        ],
      },
      links: [
        { label: 'Data quality monitoring', url: 'https://docs.databricks.com/aws/en/data-quality-monitoring/' },
        { label: 'Data profiling', url: 'https://docs.databricks.com/aws/en/lakehouse-monitoring/' },
        { label: 'Lineage system tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/lineage' },
      ],
    },
    {
      id: 'coverage',
      heading: 'Track documentation coverage with SQL',
      prose:
        'information_schema shows what is documented, so coverage becomes a query a steward can run weekly or put on a dashboard.',
      examples: [
        {
          label: 'Columns with no comment, by table',
          language: 'sql',
          code: `SELECT table_schema, table_name, count(*) AS undocumented_columns
FROM main.information_schema.columns
WHERE table_schema NOT IN ('information_schema')
  AND (comment IS NULL OR comment = '')
GROUP BY ALL
ORDER BY undocumented_columns DESC;`,
          notes: ['Pair this with certification: require complete comments before a table can be tagged certified.'],
        },
      ],
    },
  ],
  related: [
    { slug: 'monitoring', title: 'Platform observability' },
    { slug: 'access-management', title: 'Access management' },
    { slug: 'row-column-security', title: 'Row and column security' },
  ],
};
