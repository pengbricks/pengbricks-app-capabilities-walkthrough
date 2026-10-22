import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'unity-catalog-edm',
  area: 'Governance/Monitoring',
  title: 'Unity Catalog with an enterprise data management program',
  intro:
    'Unity Catalog already governs the technical side of your data on Databricks: grants, row filters and column masks, governed tags, lineage, classification, audit, and certification. An enterprise data management (EDM) program adds a business glossary, stewardship workflows, master data, and quality rules that span systems. The two overlap on tags, definitions, and lineage, so the first job is to decide who owns each kind of metadata. The second is to make Unity Catalog the place where policy is enforced, with the EDM tool supplying the intent as a governed tag.',
  businessValue: {
    summary:
      'Data governance leads who run an EDM program alongside Databricks need one answer for who owns each kind of metadata and where policy is enforced.',
    outcomes: [
      {
        title: 'Policy enforced at query time',
        body: 'A classification set by a steward becomes a governed tag, and an ABAC policy masks or filters the data for every Databricks query. A policy kept only in the EDM tool stays advisory.',
      },
      {
        title: 'No two owners of one fact',
        body: 'Each definition, tag, rule, and certification has one system of record. Teams stop editing the same tag in two tools and stop finding two answers.',
      },
      {
        title: 'Smaller scan access',
        body: 'The EDM tool reads Unity Catalog through a service principal that holds only the privileges its scan needs, so the metadata it exports is limited to what it should see.',
      },
      {
        title: 'Lineage past the platform edge',
        body: 'Outside sources and BI tools are registered as external lineage, so an impact analysis of a source change covers systems that Databricks does not run.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Unity Catalog owns technical metadata and enforcement.',
      body: 'Columns, grants, lineage, audit, row filters, and column masks come from the platform. The EDM tool reads them and does not copy them by hand.',
    },
    {
      title: 'The EDM tool owns what spans systems.',
      body: 'Business glossary, stewardship workflows, approvals, master data matching, and quality scorecards across systems usually stay in the EDM tool.',
    },
    {
      title: 'Pass policy intent as a governed tag.',
      body: 'The steward classifies in the EDM tool, a sync writes the value to a governed tag, and an ABAC policy filters or masks on that tag. Define policy once, enforce it in Unity Catalog.',
    },
    {
      title: 'Give the scanner a least-privilege service principal.',
      body: 'The EDM tool queries information_schema and system tables on a SQL warehouse. Grant only what the connector documents.',
    },
    {
      title: 'Register what Databricks cannot see.',
      body: 'Use external lineage for outside sources and BI tools, and Lakehouse Federation or catalog federation when you query outside data from Databricks.',
    },
    {
      title: 'Check release stages before you plan around a feature.',
      body: 'Governed tags, ABAC, Data Classification, external lineage, and cross-engine ABAC are generally available. Pages, tag propagation, and metastore-level ABAC are Beta.',
    },
  ],
  prerequisites: [
    {
      slug: 'unity-catalog-basics',
      title: 'Unity Catalog basics',
      why: 'The metastore, catalogs, schemas, and privileges are the objects the EDM tool reads and the policies act on.',
    },
    {
      slug: 'access-management',
      title: 'Access management',
      why: 'Groups, service principals, and grants set who can read data and who can assign tags.',
    },
    {
      slug: 'row-column-security',
      title: 'Row and column security',
      why: 'ABAC policies apply row filters and column masks, so the filter and mask functions should already make sense to you.',
    },
  ],
  sections: [
    {
      id: 'overview',
      heading: 'How the two systems fit together',
      prose:
        'The EDM tool holds intent and cross-system context. Unity Catalog holds the data, the tags, and the enforcement point. Metadata flows both ways, but only one direction is allowed to change policy.',
      diagram: {
        type: 'flow',
        title: 'EDM tool and Unity Catalog',
        description:
          'The EDM tool sends classification tags to Unity Catalog and reads metadata and lineage back. Unity Catalog policies are enforced by Databricks engines for BI and Genie consumers. External systems register lineage in Unity Catalog or are federated into it. Other Iceberg engines read filtered data through the Iceberg REST catalog.',
        nodes: [
          {
            id: 'edm',
            label: 'EDM tool',
            sub: 'glossary, stewardship, MDM',
            col: 0,
            row: 1,
            kind: 'highlight',
            icon: 'list',
            domain: 'governance',
            detail:
              'The enterprise catalog or governance tool. It holds the business glossary, stewardship workflows, approvals, master data, and cross-system quality rules.',
          },
          {
            id: 'uc',
            label: 'Unity Catalog',
            sub: 'tags, ABAC, lineage',
            col: 1,
            row: 1,
            kind: 'highlight',
            icon: 'data-model',
            domain: 'governance',
            detail:
              'Holds governed tags, ABAC policies, lineage, Data Classification results, certification, and audit. It is the system of record for technical metadata and the enforcement point for access.',
          },
          {
            id: 'engines',
            label: 'Databricks engines',
            sub: 'warehouses, serverless',
            col: 2,
            row: 0,
            icon: 'warehouse',
            domain: 'data',
            detail:
              'SQL warehouses, jobs, and notebooks evaluate ABAC row filters and column masks at query time, so the policy applies to every Databricks reader.',
          },
          {
            id: 'consumers',
            label: 'BI and Genie',
            sub: 'dashboards, agents',
            col: 3,
            row: 0,
            kind: 'surface',
            icon: 'dashboard',
            domain: 'apps',
            detail:
              'Dashboards, Genie Agents, and BI tools query through the engines and see only the rows and columns their identity allows.',
          },
          {
            id: 'ext',
            label: 'External systems',
            sub: 'lineage or federation',
            col: 1,
            row: 2,
            icon: 'cloud-database',
            domain: 'neutral',
            detail:
              'Source databases, SaaS apps, and BI tools outside Databricks. Register them as external lineage, or query them in place with Lakehouse Federation or catalog federation.',
          },
          {
            id: 'iceberg',
            label: 'Other Iceberg engines',
            sub: 'read via REST catalog',
            col: 2,
            row: 2,
            icon: 'cloud-network',
            domain: 'data',
            detail:
              'Engines such as Spark, Trino, and Flink read Unity Catalog tables through the Iceberg REST catalog. Cross-engine ABAC returns filtered data to supported clients.',
          },
        ],
        edges: [
          { from: 'edm', to: 'uc', label: 'tags' },
          { from: 'uc', to: 'engines', label: 'ABAC' },
          { from: 'engines', to: 'consumers' },
          { from: 'ext', to: 'uc', label: 'lineage' },
          { from: 'uc', to: 'iceberg', label: 'filtered' },
          { from: 'uc', to: 'edm', label: 'scan', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Metadata owners' },
          { kind: 'dashed', label: 'Read-only scan' },
        ],
        caption:
          'Tags flow from the EDM tool into Unity Catalog. The scan reads technical metadata, tags, and lineage back out.',
      },
      table: {
        caption: 'What Unity Catalog covers natively and what an EDM program adds',
        columns: ['Unity Catalog covers', 'An EDM program adds'],
        rows: [
          [
            'Grants, row filters and column masks, ABAC policies on governed tags',
            'A policy register and approval flow that spans every system, not only Databricks',
          ],
          [
            'Table and column comments, governed tags, Pages (Beta), metric views',
            'A business glossary with stewards, review cycles, and links to systems outside Databricks',
          ],
          [
            'Automatic table and column lineage on Databricks, plus external lineage you register',
            'Lineage stitched across all platforms in one graph',
          ],
          [
            'Data Classification, certification status, anomaly detection on tables (Public Preview)',
            'Stewardship workflows, issue tracking, and cross-system quality scorecards',
          ],
          [
            'Tables that hold published master data, governed like any other table',
            'Matching, merging, survivorship, and the golden record itself',
          ],
        ],
      },
    },
    {
      id: 'ownership',
      heading: 'Who owns what',
      prose:
        'Pick one system of record per kind of metadata and link to it from the other system. The matrix shows the default split. A team with no EDM tool keeps every row in Unity Catalog.',
      diagram: {
        type: 'matrix',
        title: 'Default ownership split',
        description:
          'Unity Catalog owns technical metadata, enforcement of access policy, and certification status. The EDM tool owns business definitions when it exists, defines policy intent, and owns cross-system quality rules and master data. Tags and classification have one authoring side per tag.',
        corner: 'Metadata · System',
        columns: ['Unity Catalog', 'EDM tool'],
        rows: [
          {
            label: 'Business definitions',
            cells: [
              {
                state: 'optional',
                text: 'Pages (Beta)',
                sub: 'metric views for metrics',
                detail:
                  'Use Pages and metric views when there is no EDM glossary, or for the few metrics that must compute the same way everywhere.',
              },
              { state: 'own', text: 'Glossary', sub: 'stewards and approval' },
            ],
          },
          {
            label: 'Technical metadata',
            cells: [
              { state: 'own', text: 'Captured from the platform', sub: 'columns, types, lineage' },
              { state: 'optional', text: 'Read-only copy', sub: 'via scan' },
            ],
          },
          {
            label: 'Tags and classifications',
            cells: [
              {
                state: 'own',
                text: 'Governed tags',
                sub: 'holds the value',
                detail:
                  'The governed tag in Unity Catalog is what ABAC reads. The steward may author the value in the EDM tool and sync it in.',
              },
              { state: 'optional', text: 'Authors the value', sub: 'one side per tag' },
            ],
          },
          {
            label: 'Access policy, defined',
            cells: [
              { state: 'optional', text: 'ABAC policy text' },
              { state: 'own', text: 'Policy intent', sub: 'what must be protected' },
            ],
          },
          {
            label: 'Access policy, enforced',
            cells: [
              {
                state: 'own',
                text: 'ABAC and grants',
                sub: 'query time',
              },
              { state: 'none', text: 'Advisory only', sub: 'cannot mask a query' },
            ],
          },
          {
            label: 'Quality rules',
            cells: [
              { state: 'own', text: 'Record-level rules', sub: 'pipeline expectations' },
              { state: 'own', text: 'Cross-system rules', sub: 'and scorecards' },
            ],
          },
          {
            label: 'Certification',
            cells: [
              { state: 'own', text: 'Status tag', sub: 'system.certification_status' },
              { state: 'optional', text: 'Approval workflow', sub: 'writes the tag' },
            ],
          },
          {
            label: 'Master data',
            cells: [
              { state: 'optional', text: 'Published golden records', sub: 'as governed tables' },
              { state: 'own', text: 'Match, merge, survive', sub: 'the golden record' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'System of record' },
          { state: 'optional', label: 'Holds a copy or one side' },
          { state: 'none', label: 'No role' },
        ],
        caption: 'Without an EDM tool, Unity Catalog owns every row. With one, the split above is the starting point.',
      },
      options: {
        caption: 'Where business definitions live',
        rows: [
          {
            option: 'EDM glossary as the home',
            when: 'You already run stewards, approval workflows, and a glossary that covers systems beyond Databricks.',
            tradeoffs:
              'Governance: strongest review and ownership across systems. Maintenance: a sync or link keeps Unity Catalog comments current, and drift is possible. Definitions are not queryable from SQL.',
          },
          {
            option: 'Pages (Beta) and metric views in Unity Catalog',
            when: 'Most governed data is on Databricks and you have no EDM tool, or a metric must compute the same way in SQL, dashboards, and Genie.',
            tradeoffs:
              'Docs: a Page has an owner, synonyms, and related assets, and a metric view holds the calculation. Metric views are queryable from BI tools. Pages are Beta, the docs say Page data may replicate globally, and the EDM tool will not see Pages unless you export them.',
          },
          {
            option: 'Both, split by kind',
            when: 'An enterprise glossary exists, and a short list of metrics needs one computation.',
            tradeoffs:
              'Practical guidance: terms live in the EDM glossary, calculations live in metric views, and each side links to the other. It costs one more link to maintain per term.',
          },
        ],
        recommendation:
          'Use the EDM glossary for terms when you have one, and metric views for the metrics that must compute identically. Link instead of copying text.',
      },
      links: [
        { label: 'Pages (Beta)', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
        { label: 'Metric views', url: 'https://docs.databricks.com/aws/en/metric-views/' },
      ],
    },
    {
      id: 'read',
      heading: 'How enterprise catalogs read Unity Catalog',
      prose:
        'Collibra, Atlan, and Microsoft Purview all read Unity Catalog the same way. They connect to a SQL warehouse as a service principal, query information_schema for catalogs, schemas, tables, columns, tags, and privileges, and query system tables for lineage. The information schema shows only the objects the connecting principal can see, so the principal sets the scope of what the EDM tool exports.',
      table: {
        caption: 'Documented connector behavior',
        columns: ['Tool', 'What the public docs say'],
        rows: [
          [
            'Collibra',
            'Lineage import reads system.access.column_lineage, and system.query.history for source code. The service principal needs USE CATALOG on system and USE SCHEMA on system.access and system.query. CAN USE on the warehouse is enough to integrate tags only.',
          ],
          [
            'Atlan',
            'A tag crawler imports tags. A lineage miner queries system tables through a SQL warehouse ID. Authentication is a personal access token or a service principal on AWS or Azure.',
          ],
          [
            'Microsoft Purview',
            'Scans Azure Databricks Unity Catalog through a SQL warehouse. Authentication is a personal access token, a service principal, or a managed identity. It extracts catalogs, schemas, tables, views, columns, tags, and lineage, with a scan scope by catalog.',
          ],
        ],
      },
      steps: [
        {
          title: 'Create a service principal for the scan',
          body: 'Use a dedicated service principal per tool, not a person. Give it CAN USE on one SQL warehouse. A serverless SQL warehouse keeps start time short for scheduled scans.',
        },
        {
          title: 'Grant metadata and lineage access',
          body: 'Grant USE CATALOG and USE SCHEMA on the catalogs in scope, plus what your connector lists. Purview documents SELECT on scanned tables and views and on the two lineage tables, and Atlan documents SELECT on the lineage views. Do not make the principal a metastore admin unless you want it to see everything.',
          code: '-- Lineage system tables (enable the access schema first)\nGRANT USE CATALOG ON CATALOG system TO `edm-scanner`;\nGRANT USE SCHEMA ON SCHEMA system.access TO `edm-scanner`;\nGRANT SELECT ON TABLE system.access.table_lineage TO `edm-scanner`;\nGRANT SELECT ON TABLE system.access.column_lineage TO `edm-scanner`;\n\n-- Catalogs in scope\nGRANT USE CATALOG ON CATALOG sales TO `edm-scanner`;',
        },
        {
          title: 'Add write access only when the tool pushes tags back',
          body: 'An outbound sync needs ASSIGN on each governed tag it writes and APPLY TAG on the objects. Keep that on a separate service principal from the read-only scan so a scan problem cannot change tags.',
        },
        {
          title: 'Scope and schedule the scan',
          body: 'Scan the catalogs you govern, not the whole metastore. Purview documents that large scans can time out and recommends a few catalogs at a time. Lineage in system tables appears a few minutes after a run, so schedule lineage after the jobs finish.',
        },
      ],
      links: [
        {
          label: 'Information schema',
          url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-information-schema',
        },
        { label: 'System tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' },
        {
          label: 'Collibra lineage preflight checks',
          url: 'https://productresources.collibra.com/docs/collibra/latest/Content/CollibraDataLineage/DataSources/DatabricksUnityCatalog/ref_databricks-preflight.htm',
        },
        {
          label: 'Atlan lineage and usage extraction',
          url: 'https://docs.atlan.com/apps/connectors/data-warehouses/databricks/how-tos/extract-lineage-and-usage-from-databricks',
        },
        {
          label: 'Microsoft Purview and Unity Catalog',
          url: 'https://learn.microsoft.com/en-us/purview/register-scan-azure-databricks-unity-catalog',
        },
      ],
    },
    {
      id: 'tag-sync',
      heading: 'Tag sync direction and latency',
      prose:
        'Choose one authoring side for each tag. Two writers on one tag overwrite each other, and the sync that runs last wins. Latency matters because a policy only takes effect after the governed tag lands in Unity Catalog.',
      options: {
        caption: 'Where a tag is authored',
        rows: [
          {
            option: 'EDM tool authors, Unity Catalog receives',
            when: 'Stewards already classify data in the EDM tool and you want ABAC to act on their decisions.',
            tradeoffs:
              'Governance: one classification register. Latency: Collibra documents that outbound sync runs every 5 minutes when events exist. Atlan documents that reverse sync updates existing Databricks tags and does not create or delete them, and it states no frequency. Governed tags reject values outside the tag policy, so a bad mapping fails visibly.',
          },
          {
            option: 'Unity Catalog authors, EDM tool imports',
            when: 'No tool owns classification, or Data Classification covers most columns.',
            tradeoffs:
              'Safe, because the EDM tool only reads. Data Classification typically scans a new table within 24 hours, and the import lags by one crawl. Stewards review in the EDM tool, and corrections go back as a tag change in Unity Catalog.',
          },
          {
            option: 'Split by tag key',
            when: 'Sensitivity comes from Data Classification and stewards own business tags such as domain or data owner.',
            tradeoffs:
              'Practical guidance: no tag has two writers, and sensitive tags apply without a sync wait. It needs a written list of which key belongs to which side.',
          },
        ],
        recommendation:
          'Split by tag key. Let Data Classification or the write path set sensitivity tags in Unity Catalog, let stewards author business tags in the EDM tool, and import both ways read-only otherwise.',
      },
      points: [
        {
          strong: 'Tag propagation (Beta).',
          text: 'Since October 12, 2026 you can enable propagation for a governed tag, so Unity Catalog uses lineage to apply the tag to tables and views derived by operations such as CREATE TABLE AS SELECT, CREATE VIEW, INSERT INTO SELECT, and MERGE. It keeps downstream tables protected without a second sync.',
        },
        {
          strong: 'Tag automations (Beta).',
          text: 'Since August 7, 2026 a tag automation assigns or removes governed tags on tables or volumes that match conditions you define.',
        },
        {
          strong: 'Set sensitive tags at write time.',
          text: 'A table with no tag yet has no ABAC protection. Tag a column when you create it, or rely on propagation, instead of waiting for a scheduled sync.',
        },
      ],
      links: [
        {
          label: 'Collibra outbound sync to Unity Catalog',
          url: 'https://productresources.collibra.com/docs/collibra/latest/Content/Catalog/Databricks/ta_synchronize-databricks-outbound.htm',
        },
        {
          label: 'Atlan tag import and reverse sync',
          url: 'https://docs.atlan.com/apps/connectors/data-warehouses/databricks/how-tos/manage-databricks-tags',
        },
        { label: 'Governed tags', url: 'https://docs.databricks.com/aws/en/admin/governed-tags' },
        {
          label: 'October 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/october',
        },
        {
          label: 'August 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/august',
        },
      ],
    },
    {
      id: 'enforcement',
      heading: 'Governed tags and ABAC as the enforcement contract',
      prose:
        'The contract between the two systems is a governed tag. The EDM tool says a column holds an identifier or belongs to a region. Unity Catalog stores that as a tag, and an ABAC policy turns it into a mask or filter. The EDM tool never needs to know how enforcement works.',
      steps: [
        {
          title: 'Define the governed tags and their policy',
          body: 'A governed tag has a tag policy that fixes the allowed values and who has ASSIGN. Account admins and workspace admins can create governed tags by default. Give ASSIGN on each tag to the sync service principal and to the stewards who tag by hand. Limits per the docs are 1,000 governed tags per account and 500 allowed values per tag.',
          code: "CREATE GOVERNED TAG pii\n  DESCRIPTION 'Kind of personal identifier a column holds'\n  VALUES ('id_number', 'contact');\n\nCREATE GOVERNED TAG geo_region;",
        },
        {
          title: 'Apply the tags',
          body: 'The sync job, Data Classification, or a steward applies the tag to the column. A tag set this way is what the policy reads.',
          code: 'SET TAG ON COLUMN sales.crm.customers.national_id `pii` = `id_number`;\nSET TAG ON COLUMN sales.crm.customers.region_code `geo_region`;',
        },
        {
          title: 'Create the mask and filter functions',
          body: 'ABAC policies call SQL user-defined functions. The function must exist before the policy, and the policy owner needs EXECUTE on it.',
          code: "CREATE FUNCTION gov.policies.mask_last4(val STRING)\n  RETURNS STRING\n  RETURN concat(repeat('*', greatest(length(val) - 4, 0)), right(val, 4));\n\nCREATE FUNCTION gov.policies.amer_only(region_code STRING)\n  RETURNS BOOLEAN\n  RETURN region_code = 'AMER';",
        },
        {
          title: 'Create the ABAC policies',
          body: 'A policy attaches to a catalog, schema, or table and matches columns by tag, so it covers new tables that carry the tag. It needs MANAGE on the securable or ownership, and compute on Databricks Runtime 16.4 or above, or serverless. EXCEPT lists principals that see unmasked data.',
          code: "CREATE POLICY mask_identifiers\n  ON CATALOG sales\n  COLUMN MASK gov.policies.mask_last4\n  TO analysts EXCEPT data_stewards\n  FOR TABLES\n  MATCH COLUMNS has_tag_value('pii', 'id_number') AS id_col\n  ON COLUMN id_col;\n\nCREATE POLICY restrict_to_amer\n  ON SCHEMA sales.crm\n  ROW FILTER gov.policies.amer_only\n  TO regional_analysts\n  FOR TABLES\n  MATCH COLUMNS has_tag('geo_region') AS region\n  USING COLUMNS (region);",
        },
        {
          title: 'Test as a masked user',
          body: 'Query the table as a member of the target group and as an exempt principal. Check that new tables with the tag pick up the policy, and that a table with no tag stays open, which is the case your tagging process has to prevent.',
        },
      ],
      points: [
        {
          strong: 'Identity at GA.',
          text: 'The April 28, 2026 release notes state that ABAC policies evaluate with the session user, not the view or function owner. Review views and functions built before then.',
        },
        {
          strong: 'Scope beyond tables.',
          text: 'Metastore-level policies (Beta, September 17, 2026) apply one policy across all catalogs. ABAC on views (Beta, September 29, 2026) and ABAC on time travel (Beta, September 23, 2026) extend coverage. Plan on tables until those leave Beta.',
        },
        {
          strong: 'Keep one author per policy.',
          text: 'If the EDM tool or an infrastructure pipeline creates policies, make it the only writer for those objects so two editors never overwrite each other.',
        },
      ],
      options: {
        caption: 'Where access policy is authored',
        rows: [
          {
            option: 'EDM tool defines intent, Unity Catalog holds the ABAC policy',
            when: 'You want a cross-system policy register and enforcement on Databricks.',
            tradeoffs:
              'Governance: policy intent is reviewed once and enforced in the platform at query time. Maintenance: stewards change a tag, and a platform team owns the policy text. The tag is the interface.',
          },
          {
            option: 'Policy authored only in Unity Catalog',
            when: 'Databricks holds almost all the governed data.',
            tradeoffs:
              'Direct and auditable on the platform. It covers only Databricks data, and the EDM tool sees the result through the tags and privileges it scans.',
          },
          {
            option: 'Policy kept only in the EDM tool',
            when: 'Documentation or attestation is the only goal.',
            tradeoffs:
              'It cannot mask or filter a Databricks query, so the policy is advisory. Pair it with tags and ABAC before you tell auditors it is enforced.',
          },
        ],
        recommendation:
          'Define intent in the EDM tool, pass it as a governed tag, and hold the ABAC policy in Unity Catalog.',
      },
      links: [
        {
          label: 'Attribute-based access control',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
        },
        {
          label: 'Create ABAC policies',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/policies',
        },
        {
          label: 'Create and manage governed tags',
          url: 'https://docs.databricks.com/aws/en/admin/governed-tags/manage-governed-tags',
        },
        { label: 'Tag policies', url: 'https://docs.databricks.com/aws/en/admin/tag-policies' },
        {
          label: 'April 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/april',
        },
        {
          label: 'September 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/september',
        },
      ],
    },
    {
      id: 'classification',
      heading: 'Data Classification and certification',
      prose:
        'Both features write tags that the EDM tool can import, and both are the platform side of a stewardship decision.',
      points: [
        {
          strong: 'Data Classification.',
          text: 'It uses an agentic AI system to classify columns in Unity Catalog tables on serverless compute. Detections land as class.* tags and in system.data_classification.results, which includes sample values and defaults to account admin access. New tables are typically scanned within 24 hours, then scanning is incremental. A manual full rescan costs compute. Auto-tagging needs USE CATALOG, APPLY TAG, and ASSIGN. An ABAC policy can match a class.* tag, so masking follows detection.',
        },
        {
          strong: 'Review where a wrong tag matters.',
          text: 'Detection covers every table without steward effort. Have a steward confirm columns where a miss or a false hit has a cost, then correct the tag in whichever system authors it.',
        },
        {
          strong: 'Certification.',
          text: 'The governed system tag system.certification_status takes the values certified or deprecated and works on catalogs, schemas, tables, views, volumes, functions, registered models, dashboards, Genie Agents, apps, and notebooks. Setting it needs ASSIGN on the tag and APPLY TAG on the object. Certified assets show a check mark, and deprecated assets show a warning.',
        },
        {
          strong: 'Let the EDM tool run the approval.',
          text: 'When stewards approve in the EDM tool, the final step writes the tag through the SQL, API, or SDK with a service principal that holds ASSIGN. The decision is then visible in search and in the workspace.',
        },
      ],
      examples: [
        {
          label: 'Record a steward decision in Unity Catalog',
          language: 'sql',
          code: 'SET TAG ON TABLE sales.crm.customers `system.certification_status` = `certified`;\nSET TAG ON TABLE sales.crm.customers_old `system.certification_status` = `deprecated`;',
        },
      ],
      links: [
        {
          label: 'Data Classification',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification',
        },
        {
          label: 'Certify or deprecate data',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data',
        },
      ],
    },
    {
      id: 'semantics',
      heading: 'Pages, metric views, and the EDM glossary',
      prose:
        'Pages (Beta) give a business term, acronym, or KPI one governed definition with an owner, synonyms, and related assets. Metric views hold the calculation behind a measure and can be queried from SQL, dashboards, Genie Agents, and BI tools such as Power BI, Tableau, and Sigma. Neither replaces a cross-system glossary with stewardship workflows.',
      options: {
        caption: 'Glossary placement',
        rows: [
          {
            option: 'EDM glossary only',
            when: 'Stewardship across systems is the point and consumers do not need the definition inside Databricks.',
            tradeoffs:
              'Mature approval and ownership. Genie Agents and Databricks users do not see the definitions unless you copy them into comments, which can drift.',
          },
          {
            option: 'Pages and metric views only',
            when: 'Databricks is the main platform and the glossary is modest.',
            tradeoffs:
              'Definitions sit next to the data, and Genie One prioritizes a published Page over inferred context and cites it. Pages are Beta. Page data is encrypted with Databricks-managed keys, does not support customer-managed keys, and may replicate globally, so keep sensitive text out.',
          },
          {
            option: 'EDM glossary plus metric views',
            when: 'An enterprise glossary exists and a few metrics need one computation everywhere.',
            tradeoffs:
              'Terms stay governed in the EDM tool and metric views carry the logic. The metric view name is the link between the two.',
          },
        ],
        recommendation:
          'Keep terms in the EDM glossary when you have one, put calculations in metric views, and add Pages only after you confirm the Beta fits.',
      },
      links: [
        { label: 'Pages (Beta)', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
        { label: 'Metric views', url: 'https://docs.databricks.com/aws/en/metric-views/' },
      ],
    },
    {
      id: 'lineage',
      heading: 'Lineage: system tables, external lineage, and the gaps',
      prose:
        'Unity Catalog captures lineage to the column level for queries on Databricks and writes it to system.access.table_lineage and system.access.column_lineage. External lineage covers the rest, but the two sources are separate.',
      points: [
        {
          strong: 'Retention.',
          text: 'The system tables keep 365 days of lineage. Catalog Explorer keeps lineage captured after September 1, 2024 indefinitely.',
        },
        {
          strong: 'Gaps inside Databricks.',
          text: 'Lineage is not preserved for renamed catalogs, schemas, tables, views, or columns. Column lineage is missing for path-based references, and column-level lineage through user-defined functions is not captured. RDDs and global temp views are excluded.',
        },
        {
          strong: 'External lineage.',
          text: 'You create external metadata objects for outside tables and dashboards, then relate them to Unity Catalog tables, models, or each other. The UI, the External Metadata and External Lineage APIs, and the Python SDK all work, and Lakeflow Connect pipelines record source lineage on their own. It needs CREATE EXTERNAL METADATA on the metastore. The limit is 10,000 external objects and 100,000 relationships per metastore. Column mapping is manual.',
        },
        {
          strong: 'The catch.',
          text: 'External lineage is not recorded in the lineage system tables. A connector that reads only those tables, as the Collibra, Atlan, and Purview lineage features do, will not see it. Purview also documents that it does not support lineage for external tables, and shows partial lineage when workspaces are left out of the scan.',
        },
      ],
      options: {
        caption: 'Where to record lineage for systems outside Databricks',
        rows: [
          {
            option: 'External lineage in Unity Catalog',
            when: 'Impact analysis starts in Databricks, such as a source table change that affects a dashboard.',
            tradeoffs:
              'Visible in Catalog Explorer next to automatic lineage. Maintenance: someone registers the objects and maps columns, except for Lakeflow Connect sources. Not in system tables, so scanners do not receive it.',
          },
          {
            option: 'EDM tool only',
            when: 'The EDM tool is already the lineage graph of record and it connects to the outside systems directly.',
            tradeoffs:
              'One graph for the whole estate, built from its own connectors. The Databricks hop comes from the system tables, so the EDM tool joins the two halves.',
          },
          {
            option: 'Both',
            when: 'Databricks teams need outside context in Catalog Explorer and governance needs one graph.',
            tradeoffs:
              'Best coverage, and the highest upkeep. Pick one as the source for each outside system to avoid conflicting records.',
          },
        ],
        recommendation:
          'Register external lineage for the outside systems your Databricks teams need to see, and let the EDM tool stitch the estate-wide graph.',
      },
      links: [
        { label: 'Data lineage', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage' },
        {
          label: 'External lineage',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/external-lineage',
        },
        { label: 'June 2026 release notes', url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/june' },
      ],
    },
    {
      id: 'outside',
      heading: 'Data outside Databricks',
      prose:
        'Pick the lightest option that meets the need. Both federation types are read-only and are governed through a Unity Catalog foreign catalog with table-level access control.',
      options: {
        caption: 'Handling external data',
        rows: [
          {
            option: 'Lakehouse Federation (query federation)',
            when: 'Ad hoc reporting, BI, or proof of concept against operational databases such as MySQL, PostgreSQL, SQL Server, Oracle, or Snowflake.',
            tradeoffs:
              'Queries run through JDBC with pushdown to the source, so the source carries the load. Governance: grants on the foreign catalog. Read-only.',
          },
          {
            option: 'Catalog federation',
            when: 'Incremental migration or a long-term hybrid with Hive metastore, AWS Glue, or Snowflake catalogs whose data sits in object storage.',
            tradeoffs:
              'Docs: reads the foreign table in object storage on Databricks compute, which is more cost-effective and faster than query federation. It needs storage credentials and external locations. Read-only.',
          },
          {
            option: 'External lineage only',
            when: 'You never query the system from Databricks but need to show it as a source or consumer.',
            tradeoffs:
              'Cheapest, and no data access. Governance of the outside data stays in the source system or the EDM tool.',
          },
          {
            option: 'Leave it in the EDM tool',
            when: 'The system has no relationship to Databricks data.',
            tradeoffs: 'The EDM tool remains the catalog of record for it. Nothing to maintain in Unity Catalog.',
          },
        ],
        recommendation:
          'Use federation when people query the data from Databricks, external lineage when they only need to see the flow, and keep the rest in the EDM tool.',
      },
      links: [
        { label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' },
        {
          label: 'External lineage',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/external-lineage',
        },
      ],
    },
    {
      id: 'master-data',
      heading: 'Master data golden records in Unity Catalog',
      prose:
        'Matching, merging, and survivorship stay in the master data tool, because Unity Catalog does not run them. Publish the result as tables so the same governance applies as for any other data.',
      steps: [
        {
          title: 'Publish golden records to a governed schema',
          body: 'Land the golden record and its source-ID crosswalk as Unity Catalog tables in a schema that the master data owner controls. Ask the vendor how it writes to Delta tables and whether it supports a crosswalk, because that varies by product. If it cannot write directly, export to a volume and load with a Lakeflow pipeline.',
        },
        {
          title: 'Tag sensitive attributes',
          body: 'Apply the governed tags that your ABAC policies read, so a consumer who only needs the record link gets masked attributes without extra work.',
        },
        {
          title: 'Certify the published tables',
          body: 'Set system.certification_status to certified on the golden tables when the data steward signs off, so consumers pick them over the source copies.',
        },
        {
          title: 'Check freshness',
          body: 'Record-level rules run in the pipeline that loads the tables. Data quality monitoring anomaly detection (Public Preview) checks freshness and completeness and logs to system.data_quality_monitoring.table_results, which an EDM tool can read.',
        },
      ],
      links: [
        { label: 'Governed tags', url: 'https://docs.databricks.com/aws/en/admin/governed-tags' },
        { label: 'Lakeflow pipeline expectations', url: 'https://docs.databricks.com/aws/en/ldp/expectations' },
        {
          label: 'Anomaly detection',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/anomaly-detection/',
        },
      ],
    },
    {
      id: 'cross-engine',
      heading: 'Enforcement for other engines over the Iceberg REST catalog',
      prose:
        'Unity Catalog serves Iceberg clients through its Iceberg REST catalog at /api/2.1/unity-catalog/iceberg-rest. For tables with ABAC policies, row filters, or column masks, cross-engine ABAC makes Databricks serverless compute filter the data and return only the sanitized result to the external engine. Cross-engine ABAC became generally available on October 1, 2026, after a Beta in May 2026.',
      points: [
        {
          strong: 'Requirements.',
          text: 'External data access enabled on the metastore, EXTERNAL USE SCHEMA for the principal, managed tables with catalog commits, and OAuth machine-to-machine or a personal access token. Tables need Databricks Runtime 16.4 or above when new, and 18.0 or above when you upgrade existing tables.',
        },
        {
          strong: 'Clients.',
          text: 'Docs list Apache Spark 4.0 or above with Iceberg-Spark 1.11 or above for Iceberg, and Delta-Spark 4.1 or above with the Unity Catalog Spark connector 0.4 or above for Delta. Set serverSidePlanning.enabled to true. Other engines that read plain tables, such as Trino and Flink, are not listed for tables with policies, so test each one.',
        },
        {
          strong: 'Limits.',
          text: 'Reads only; writes need a policy exemption. Dynamic views, VARIANT column projection, BINARY filtering, and column masks with differing return types are unsupported, and large aggregations may be slower. Serverless compute is billed, and system.billing.usage shows the cost.',
        },
        {
          strong: 'No maintenance.',
          text: 'External Iceberg clients cannot run table maintenance such as expiring snapshots.',
        },
      ],
      links: [
        { label: 'Cross-engine ABAC', url: 'https://docs.databricks.com/aws/en/external-access/cross-engine-abac' },
        { label: 'Iceberg REST catalog access', url: 'https://docs.databricks.com/aws/en/external-access/iceberg' },
      ],
    },
    {
      id: 'stages',
      heading: 'Release stages',
      prose:
        'Dates come from the Databricks release notes and the docs pages for each feature, as of October 21, 2026. Check the notes again before you plan around any Beta or Public Preview.',
      table: {
        caption: 'Stage and date',
        columns: ['Feature', 'Stage and date'],
        rows: [
          ['Governed tags', 'Generally available, April 2, 2026'],
          [
            'Data Classification',
            'Generally available, April 20, 2026. API and Terraform resource generally available October 14, 2026',
          ],
          ['Data Classification auto-tagging configuration', 'Public Preview'],
          ['Data Classification of views', 'Beta, September 15, 2026'],
          ['ABAC row filters and column masks', 'Generally available, April 28, 2026'],
          ['Metastore-level ABAC policies', 'Beta, September 17, 2026'],
          ['ABAC on views', 'Beta, September 29, 2026'],
          ['Tag automations', 'Beta, August 7, 2026'],
          ['Governed tag propagation', 'Beta, October 12, 2026'],
          ['External lineage', 'Generally available, June 8, 2026'],
          ['Cross-engine ABAC', 'Generally available, October 1, 2026'],
          ['Discover page and domains', 'Generally available, October 8, 2026'],
          ['Pages for business terms', 'Beta, August 12, 2026'],
          [
            'Certification status system tag',
            'Public Preview in the October 2025 release notes. The current docs page gives no stage, so confirm',
          ],
          ['Data quality anomaly detection', 'Public Preview'],
          ['Metric view window measures', 'Generally available, October 6, 2026'],
        ],
      },
      links: [
        {
          label: 'October 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/october',
        },
        {
          label: 'September 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/september',
        },
        {
          label: 'August 2026 release notes',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/august',
        },
      ],
    },
    {
      id: 'adopt',
      heading: 'Adopt it in this order',
      steps: [
        {
          title: 'Agree the ownership matrix',
          body: 'Fill in who owns each row, and name the one author for each tag key.',
        },
        {
          title: 'Create the governed tags and the sync service principal',
          body: 'Define the tag policies, grant ASSIGN, and test one tag end to end from the EDM tool to a column.',
        },
        {
          title: 'Add the first ABAC policy and test it',
          body: 'Start with one mask on one tag, and check an exempt principal and a new table.',
        },
        {
          title: 'Connect the scan',
          body: 'Create the read-only service principal, grant the documented privileges, and scan a few catalogs.',
        },
        {
          title: 'Register external lineage and certification',
          body: 'Add outside sources that your Databricks teams need, and wire steward approval to the certification tag.',
        },
      ],
    },
  ],
  related: [
    { slug: 'ontology', title: 'Business terms and synonyms' },
    { slug: 'data-observability', title: 'Lineage and drift detection' },
    { slug: 'documentation-generation', title: 'Automated data documentation' },
    { slug: 'metric-views', title: 'Metric views' },
    { slug: 'iceberg-support', title: 'Apache Iceberg interoperability' },
    { slug: 'data-validation-framework', title: 'Data validation framework' },
  ],
};
