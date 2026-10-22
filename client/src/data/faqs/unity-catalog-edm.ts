import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'What does Unity Catalog govern natively that overlaps with an enterprise data management program?',
    answer:
      'Unity Catalog covers the technical half of governance: grants, row filters and column masks, governed tags, automatic lineage, data classification, audit logs, certification flags and discovery. An enterprise data management (EDM) program usually adds a business glossary, stewardship workflows, master data and cross-system quality rules, which Unity Catalog covers only in part. The two overlap on tags, definitions and lineage, so decide early which system owns each of those.',
    links: [
      { label: 'Governed tags', url: 'https://docs.databricks.com/aws/en/admin/governed-tags' },
      {
        label: 'Attribute-based access control',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
      },
      { label: 'Data lineage', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage' },
    ],
  },
  {
    question: 'What do lineage and system tables expose to an external catalog or governance tool?',
    answer:
      'Unity Catalog captures table and column lineage automatically for queries that run on Databricks and exposes it in system.access.table_lineage and system.access.column_lineage. The system tables page lists 365 days of retention for both, plus system.access.audit for audit events. Catalog Explorer keeps lineage for data captured after September 1, 2024 indefinitely. Column lineage is missing when a source or target is referenced by file path, and user-defined functions hide column mappings.',
    links: [
      { label: 'Data lineage', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage' },
      { label: 'System tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' },
    ],
  },
  {
    question: 'How do enterprise catalogs read metadata from Unity Catalog?',
    answer:
      'They connect through a SQL warehouse and read information_schema and system tables, then ingest the results. The information schema returns tags, columns, privileges and comments, filtered to the objects the connecting principal can see. Collibra documents tag import through the information schema and lineage import from system.access.column_lineage. Atlan documents a tag crawler plus a lineage miner that queries system tables. Microsoft Purview documents a scan through a SQL warehouse that extracts catalogs, schemas, tables, views, tags and lineage. Give the connecting principal only the privileges the scan needs, because the metadata it sees is the metadata it exports.',
    links: [
      {
        label: 'Information schema',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-information-schema',
      },
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
    question: 'Which Unity Catalog governance features are Beta or Preview today?',
    answer:
      'As of October 2026, governed tags (GA April 2, 2026), Data Classification for tables (GA April 20, 2026), ABAC row filters and column masks (GA April 28, 2026), external lineage (GA June 8, 2026), the Discover page (GA October 8, 2026), and cross-engine ABAC (GA October 1, 2026) are generally available. Metric view window measures went GA on October 6, 2026, and the metric views docs page states no overall stage. Pages for business terms (Beta, August 12, 2026), governed tag propagation (Beta, October 12, 2026), custom classifiers, classification of views (Beta, September 15, 2026) and metastore-level ABAC policies (Beta, September 17, 2026) are in Beta. Data quality anomaly detection is in Public Preview, and access requests were announced in Public Preview on August 11, 2025. Check the release notes before you plan around any of these.',
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
      { label: 'June 2026 release notes', url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/june' },
      { label: 'April 2026 release notes', url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/april' },
    ],
  },
  {
    kind: 'decision',
    question: 'Which system should be the source of truth for business definitions and which for technical metadata?',
    answer:
      'Keep technical metadata in Unity Catalog, because it is captured from the platform itself. Put business definitions in the EDM glossary if you already run one with stewards and approval workflows. If you have no EDM tool, Unity Catalog Pages (Beta) hold governed definitions of terms, acronyms and KPIs, and metric views hold governed metric logic. Pick one home per definition, and link to it from the other system instead of copying the text.',
    links: [
      { label: 'Unity Catalog Pages', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
      { label: 'Metric views', url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/' },
    ],
  },
  {
    kind: 'decision',
    question: 'Where should access policy be enforced when an EDM tool also defines policy?',
    answer:
      'Enforce in Unity Catalog and treat the EDM tool as the place where policy intent is defined. Unity Catalog attribute-based access control (ABAC) policies apply row filters and column masks by governed tag at the catalog, schema or table level, with exempt principals and a requirement of Databricks Runtime 16.4 or serverless compute. An EDM tool cannot enforce a query-time mask on a Databricks table, so a policy that lives only in the EDM tool stays advisory. Pass the intent to Unity Catalog as a tag and let the ABAC policy do the work.',
    links: [
      {
        label: 'Attribute-based access control',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
      },
      {
        label: 'Create ABAC policies',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/policies',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Should classifications and tags flow from the EDM tool into Unity Catalog, or the other way?',
    answer:
      'Choose one authoring side per tag. If stewards already classify data in the EDM tool, push those values into Unity Catalog governed tags so ABAC policies can act on them. If no tool owns classification, let Data Classification detect sensitive columns in Unity Catalog and have the EDM tool import the tags. Collibra documents outbound mapping to Unity Catalog tags, and Atlan documents reverse sync that updates existing Databricks tags only, so confirm what your tool writes before you design around it.',
    links: [
      {
        label: 'Data Classification',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification',
      },
      {
        label: 'Collibra outbound sync to Unity Catalog',
        url: 'https://productresources.collibra.com/docs/collibra/latest/Content/Catalog/Databricks/ta_synchronize-databricks-outbound.htm',
      },
      {
        label: 'Atlan tag import and reverse sync',
        url: 'https://docs.atlan.com/apps/connectors/data-warehouses/databricks/how-tos/manage-databricks-tags',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'When is Unity Catalog alone enough, with no separate EDM tool?',
    answer:
      'Unity Catalog alone usually suffices when most governed data lives on Databricks and the program needs access control, classification, lineage, audit and a modest glossary. Governed tags, ABAC, Data Classification, Discover, certification flags, Pages (Beta) and metric views cover that scope. Add an EDM tool when stewardship workflows, approvals and a glossary must span systems outside Databricks. You can start on the platform and connect an enterprise tool later, because the tags, grants and lineage it would read already exist.',
    links: [
      {
        label: 'Certify or deprecate data',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data',
      },
      {
        label: 'Data Classification',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification',
      },
      { label: 'Unity Catalog Pages', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
    ],
  },
  {
    kind: 'decision',
    question: 'How should data that lives outside Databricks be handled?',
    answer:
      'Pick the lightest option that meets the need. For data in external databases or catalogs you query from Databricks, use Lakehouse Federation, which puts foreign catalogs under Unity Catalog table-level access control. Catalog federation covers sources such as Hive metastores, AWS Glue and Snowflake, and both federation types are read-only. For data you never query from Databricks, leave it in the EDM tool and register its lineage with external lineage. Plan for the EDM tool to remain the catalog of record for systems Unity Catalog does not reach.',
    links: [
      { label: 'Lakehouse Federation', url: 'https://docs.databricks.com/aws/en/query-federation/' },
      {
        label: 'External lineage',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/external-lineage',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Where should data quality rules live?',
    answer:
      'Put record-level rules in the pipeline that writes the table, and put cross-system rules and scorecards in the EDM tool. Lakeflow pipeline expectations check each record and can warn, drop or fail the update, with metrics in the pipeline UI. Data quality monitoring anomaly detection (Public Preview) checks table freshness and completeness and logs results to system.data_quality_monitoring.table_results, which an EDM tool can read. Match and merge quality for master data stays with the master data tool.',
    links: [
      { label: 'Lakeflow pipeline expectations', url: 'https://docs.databricks.com/aws/en/ldp/expectations' },
      {
        label: 'Anomaly detection',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/anomaly-detection/',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Who should own stewardship workflows and certification decisions?',
    answer:
      'Run approvals in the EDM tool when it already holds your stewards, roles and audit trail, and record the outcome in Unity Catalog. Certification in Unity Catalog is the governed system tag system.certification_status with the values certified and deprecated, and only principals with ASSIGN on that tag can set it. Writing the steward decision there makes it visible to every user in search and in the workspace. Without an EDM tool, give domain owners the ASSIGN privilege and keep the review process in a shared runbook.',
    links: [
      {
        label: 'Certify or deprecate data',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data',
      },
      {
        label: 'Access request destinations',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/access-request-destinations',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'How should master data and golden records be published to Databricks?',
    answer:
      'Publish golden records from the master data tool into Unity Catalog tables, so the same masking and access policies apply as for any other governed table. Keep matching, merging and survivorship in the master data tool, because Unity Catalog does not run those steps. Confirm with the vendor how it writes to Delta tables and whether it supports a source-ID crosswalk, since that support varies by product. Tag sensitive attributes in the published tables so ABAC masks them for people who only need the record link.',
    links: [
      { label: 'Governed tags', url: 'https://docs.databricks.com/aws/en/admin/governed-tags' },
      {
        label: 'Create ABAC policies',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/policies',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does it cost to run two catalogs side by side instead of one?',
    answer:
      'Two catalogs give you enterprise-wide search, a cross-system glossary and stewardship workflows, but they add a second copy of metadata that can drift. Each sync needs a service principal, a SQL warehouse, system table grants and monitoring. One catalog is cheaper to run and has no drift, but it cannot describe systems outside Databricks. Treat Unity Catalog as the system of record for technical metadata in both cases, and let the EDM tool hold only what Unity Catalog does not.',
    links: [
      {
        label: 'Microsoft Purview and Unity Catalog',
        url: 'https://learn.microsoft.com/en-us/purview/register-scan-azure-databricks-unity-catalog',
      },
      { label: 'System tables', url: 'https://docs.databricks.com/aws/en/admin/system-tables/' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'How do sync direction and latency affect governance?',
    answer:
      'Inbound sync, from Unity Catalog to the EDM tool, is simple and safe because the tool only reads. Outbound sync gives stewards one place to edit but delays enforcement, since a policy takes effect only after the tag lands in Unity Catalog. Collibra documents that outbound processing runs every five minutes when events exist, and Atlan documents that reverse sync updates only existing tags. A lineage crawl also lags, because system tables fill a few minutes after a run. Set sensitive tags at write time or with Data Classification instead of waiting for a scheduled sync.',
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
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Should policy be authored in the EDM tool or in Unity Catalog?',
    answer:
      "Authoring in the EDM tool keeps one policy register across all systems but adds a hop and a dependency on that tool's connector. Authoring in Unity Catalog is direct and auditable on the platform, but covers only Databricks data. A workable split has the EDM tool define classification and intent, and Unity Catalog hold the ABAC policy that acts on the tag. Whichever tool pushes policies into Unity Catalog should be the only author for those objects, so two editors never overwrite each other.",
    links: [
      {
        label: 'Create ABAC policies',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/policies',
      },
      { label: 'Governed tags', url: 'https://docs.databricks.com/aws/en/admin/governed-tags' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Should the business glossary live in Unity Catalog Pages and metric views or in the EDM glossary?',
    answer:
      'The EDM glossary wins on approval workflows, ownership across systems and a mature stewardship process. Pages and metric views win on proximity, because the definition sits next to the data and metric views can be queried from SQL, dashboards, Genie Agents and BI tools such as Power BI, Tableau and Sigma. Pages are in Beta, and the docs say page data may replicate globally, so keep personal or regulated data out of them. A common split keeps the enterprise glossary in the EDM tool and uses metric views for the few metrics that must compute the same way everywhere.',
    links: [
      { label: 'Unity Catalog Pages', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
      { label: 'Metric views', url: 'https://docs.databricks.com/aws/en/uc-semantics/metric-views/' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'How complete can lineage be inside versus outside Databricks?',
    answer:
      'Lineage inside Databricks is automatic but has gaps, such as path-based references, user-defined functions and renamed objects. Lineage outside Databricks needs registration. External lineage lets you add outside sources and BI tools through the UI, the External Metadata and External Lineage APIs, or the Python SDK, up to 10,000 external objects and 100,000 relationships per metastore. External lineage does not appear in the lineage system tables, so an EDM tool that reads only system tables will not see it. Microsoft Purview also documents that it shows partial lineage when you leave workspaces out of the scan.',
    links: [
      {
        label: 'External lineage',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/external-lineage',
      },
      { label: 'Data lineage', url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage' },
      {
        label: 'Microsoft Purview and Unity Catalog',
        url: 'https://learn.microsoft.com/en-us/purview/register-scan-azure-databricks-unity-catalog',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does automated classification gain over steward-assigned tags, and what does it cost?',
    answer:
      'Automated classification covers every table without steward effort and typically scans new tables within 24 hours. It also needs serverless compute, higher cost on the first scan, and review of the results. Detections land as class.* tags and in system.data_classification.results, which includes sample values and defaults to account admin access. Organization-specific data types need custom classifiers (Beta) or manual tags. Use automation for broad coverage and steward review for the columns where a wrong tag has consequences.',
    links: [
      {
        label: 'Data Classification',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification',
      },
      {
        label: 'Custom classifiers',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification-custom-classifiers',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What should I expect for enforcement when other engines read the same tables?',
    answer:
      'Reading through the Unity Catalog Iceberg REST catalog lets other engines use the same tables, but enforcement depends on client support. Cross-engine ABAC (GA October 1, 2026) has Databricks serverless compute filter the data before it reaches the engine. The docs name Apache Spark clients with specific Delta and Iceberg versions and a serverSidePlanning.enabled setting, and they bill the serverless compute. External Iceberg clients also cannot run table maintenance such as expiring snapshots. Test each engine against a masked table before you tell auditors that one policy covers every reader.',
    links: [
      { label: 'Iceberg REST catalog access', url: 'https://docs.databricks.com/aws/en/external-access/iceberg' },
      {
        label: 'Attribute-based access control',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/',
      },
    ],
  },
];
