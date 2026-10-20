export const categories = [
  'Foundations',
  'CI/CD & Version Control Guides',
  'Governance/Monitoring',
  'AI Guides',
  'ML Guides',
  'Ingestion',
  'General Guides',
  'Data Engineering Guides',
  'Analyst Guides',
] as const;

export type GuideCategory = (typeof categories)[number];

/** How much Databricks experience a guide assumes, from 1 (none) to 5 (deep platform and engineering background). */
export const difficulties = [1, 2, 3, 4, 5] as const;

export type Difficulty = (typeof difficulties)[number];

export type Guide = {
  slug: string;
  title: string;
  category: GuideCategory;
  difficulty: Difficulty;
  summary: string;
  acceptanceCriteria: string;
  evidence: readonly string[];
  codeUrl?: string;
  runUrl?: string;
};

export const guides: readonly Guide[] = [
  {
    slug: 'how-databricks-works',
    title: 'How Databricks works',
    category: 'Foundations',
    difficulty: 1,
    summary: 'The lakehouse: open tables in your storage, compute that comes and goes, one catalog over both.',
    acceptanceCriteria:
      'Explain where data lives, where compute runs, and what the control plane does. Show that two kinds of compute read the same table and that stopping compute leaves the data in place.',
    evidence: [
      'Control plane, compute plane, and storage diagram',
      'Same table queried from a notebook and a SQL warehouse',
      'Compute and storage billed and scaled separately',
    ],
  },
  {
    slug: 'unity-catalog-basics',
    title: 'Unity Catalog basics',
    category: 'Foundations',
    difficulty: 1,
    summary: 'Catalogs, schemas, and tables: how every object is named, found, and granted.',
    acceptanceCriteria:
      'Create a catalog, a schema, a table, and a volume, query the table by its three-level name, grant a group read access, and find the table and its lineage in Catalog Explorer.',
    evidence: [
      'Metastore, catalog, schema, and object hierarchy',
      'Three-level names and a group grant',
      'Lineage and ownership in Catalog Explorer',
    ],
  },
  {
    slug: 'medallion-architecture',
    title: 'Medallion architecture',
    category: 'Foundations',
    difficulty: 1,
    summary: 'Bronze, silver, and gold: raw data in, cleaned data in the middle, business tables out.',
    acceptanceCriteria:
      'Land raw records in bronze, clean and deduplicate them into silver, and build a gold aggregate a dashboard can read, each layer a set of tables with a clear owner and contract.',
    evidence: [
      'What each layer holds and who reads it',
      'Bronze to silver to gold pipeline',
      'Quality rules applied between layers',
    ],
  },
  {
    slug: 'configuration-vs-code',
    title: 'Configuration-driven ingestion',
    category: 'Ingestion',
    difficulty: 4,
    summary: 'Separate provider-specific adapters from reusable control-plane services.',
    acceptanceCriteria:
      'Two providers land through one shared framework. Only a feed config and a 20-line adapter differ between them; validation, quarantine, audit, and error handling are shared.',
    evidence: [
      'Provider adapter and shared framework boundary',
      'Common validation, audit, and exception flow',
      'Run trace proving shared orchestration behavior',
    ],
  },
  {
    slug: 'reusability-templatization',
    title: 'Reusable ingestion templates',
    category: 'Ingestion',
    difficulty: 4,
    summary: 'Prove that a second source can be onboarded without rebuilding the framework.',
    acceptanceCriteria:
      'A second provider is added with a spec entry and a rendered feed config. The same job, rules, and tables handle both feeds.',
    evidence: [
      'Two representative source configurations',
      'Mapping-only onboarding diff',
      'Comparable successful runs for both feeds',
    ],
  },
  {
    slug: 'batch-real-time-ingestion',
    title: 'Batch and streaming ingestion',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Demonstrate priority batch and supported streaming ingestion patterns.',
    acceptanceCriteria:
      'A batch framework run and a streaming Lakeflow pipeline share one job. Auto Loader picks up new files, expectations drop bad rows, and latency is measured per row.',
    evidence: [
      'Batch and streaming reference pipelines',
      'Latency and throughput measurements',
      'Scaling, checkpoint, and monitoring evidence',
    ],
  },
  {
    slug: 'ide-developer-experience',
    title: 'Developer workflow in the IDE',
    category: 'CI/CD & Version Control Guides',
    difficulty: 3,
    summary: 'Capture a representative author, debug, and test workflow.',
    acceptanceCriteria:
      'Write a transform in VS Code, debug its edge case with Databricks Connect, and run the same tests locally and on serverless before deploying with a bundle.',
    evidence: [
      'Local and workspace development workflow',
      'Debug and test transcript',
      'Developer setup and dependency notes',
    ],
  },
  {
    slug: 'dab-starter',
    title: 'Running a Declarative Automation Bundle',
    category: 'CI/CD & Version Control Guides',
    difficulty: 2,
    summary: 'Download a starter bundle, push it to your Git repo, then validate, deploy, and run it with the CLI.',
    acceptanceCriteria:
      'A starter bundle is downloaded, pushed to your own Git repo, validated, deployed to a development target, and run. A serverless Lakeflow Declarative Pipeline builds bronze, silver, and gold tables from synthetic orders. The same bundle then deploys to a prod target and is destroyed cleanly.',
    evidence: [
      'Validated, deployed, and run bundle in the development target',
      'Bronze, silver, and gold tables with expectation results',
      'Second deployment to a production target, and a CI workflow that validates and deploys',
    ],
  },
  {
    slug: 'github-cicd',
    title: 'GitHub-based CI/CD',
    category: 'CI/CD & Version Control Guides',
    difficulty: 4,
    summary: 'Promote one traceable release across development and test.',
    acceptanceCriteria:
      'A pull request runs tests, a merge deploys the commit to dev, and an approval promotes the same commit to test. Every resource carries the release SHA.',
    evidence: [
      'GitHub source and release reference',
      'Development and test deployment runs',
      'Approval and immutable release evidence',
    ],
  },
  {
    slug: 'versioning',
    title: 'Data contract versioning',
    category: 'CI/CD & Version Control Guides',
    difficulty: 4,
    summary: 'Show compatible evolution and governed breaking-change handling.',
    acceptanceCriteria:
      'A data contract moves from v1 to v2. Nonbreaking changes evolve the table in place; the breaking change ships as a new version with a deprecated compatibility view, and consumers are notified.',
    evidence: [
      'Compatible and breaking change examples',
      'Consumer impact and notification record',
      'Deprecation timeline and traceability',
    ],
  },
  {
    slug: 'model-deployment-cicd',
    title: 'Model release pipeline',
    category: 'ML Guides',
    difficulty: 5,
    summary: 'Release an approved model through an auditable automated path.',
    acceptanceCriteria:
      'A model is trained, tested against the current champion, approved, and served from a Model Serving endpoint. Every release is recorded.',
    evidence: [
      'Model approval and automated quality gates',
      'Environment-specific deployment configuration',
      'Serving release and audit history',
    ],
  },
  {
    slug: 'dataops',
    title: 'Pipeline operations',
    category: 'CI/CD & Version Control Guides',
    difficulty: 3,
    summary: 'Exercise day-two controls across isolated environments.',
    acceptanceCriteria:
      'One job shows retries, failure and duration alerts, run history, an audit trail, and a rollback to an earlier table version.',
    evidence: [
      'Development and test environment boundaries',
      'Failure, alert, and recovery run',
      'Rollback or redeployment evidence',
    ],
  },
  {
    slug: 'documentation-generation',
    title: 'Automated data documentation',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary: 'Generate governed technical and usage documentation from platform metadata.',
    acceptanceCriteria:
      'A job writes one documentation page per table covering schema, lineage, quality, ownership, and usage, and applies AI-drafted comments in Unity Catalog.',
    evidence: [
      'Generated schema and ownership documentation',
      'Lineage and quality metadata',
      'Refresh workflow and usage guidance',
    ],
  },
  {
    slug: 'monitoring',
    title: 'Platform observability',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary: 'Unify operational, usage, cost, and audit signals.',
    acceptanceCriteria:
      'System tables feed one dashboard for runs, failures, cost, compute, and audit events, and a SQL alert emails the owner.',
    evidence: [
      'Consolidated monitoring view',
      'Failure-to-owner alert route',
      'Compute, capacity, usage, and audit evidence',
    ],
  },
  {
    slug: 'ai-functions',
    title: 'AI Functions in SQL',
    category: 'AI Guides',
    difficulty: 2,
    summary:
      'Classify, extract, mask, translate, and parse documents from SQL, and know when to build your own instead.',
    acceptanceCriteria:
      'Pick the right AI Function for a task, run it once in a pipeline or job and keep the result, return structured output, evaluate it against labeled rows, and check the models, permissions, data residency, and compliance settings before it touches regulated data.',
    evidence: [
      'Task function, ai_query, or hand-built, chosen for each job',
      'Structured output, error handling, and evaluation against labeled rows',
      'Model, permission, residency, and compliance checks before regulated data',
    ],
  },
  {
    slug: 'user-experience',
    title: 'Assistant user experience',
    category: 'AI Guides',
    difficulty: 2,
    summary: 'Observe representative users completing core discovery tasks.',
    acceptanceCriteria:
      'People find data, ask a question, refine the answer, and leave feedback in an assistant; issues and training needs are logged.',
    evidence: [
      'Representative user task script',
      'Observed outcomes and feedback',
      'Issue and training-needs register',
    ],
  },
  {
    slug: 'ontology',
    title: 'Business terms and synonyms',
    category: 'AI Guides',
    difficulty: 2,
    summary: 'Improve discovery through governed concepts and synonyms.',
    acceptanceCriteria:
      'Business terms and synonyms are defined once and used to improve search and question answering.',
    evidence: [
      'Priority concept and synonym model',
      'Before-and-after discovery examples',
      'Interpretation quality evidence',
    ],
  },
  {
    slug: 'agent-framework-support',
    title: 'Agents, MCP, and model gateway',
    category: 'AI Guides',
    difficulty: 5,
    summary: 'Evaluate governed MCP, A2A, and model-gateway operations end to end.',
    acceptanceCriteria:
      'One governed MCP tool call, one agent-to-agent handoff, and the same prompt routed to two models through a gateway with limits, safety checks, tracing, and fallback.',
    evidence: [
      'Governed MCP call and cross-agent trace',
      'Two-model gateway comparison and fallback',
      'Controls, cost, latency, and portability matrix',
    ],
  },
  {
    slug: 'agent-build-deployment',
    title: 'Building and shipping agents',
    category: 'AI Guides',
    difficulty: 5,
    summary: 'Document the full assistant build-to-operations lifecycle.',
    acceptanceCriteria:
      'An assistant is built, deployed, versioned, secured, and monitored, with its code, dependencies, and owners documented.',
    evidence: [
      'Versioned assistant implementation',
      'Security and deployment configuration',
      'Monitoring and operational ownership record',
    ],
  },
  {
    slug: 'data-ingestion-feature-preparation',
    title: 'Feature preparation from source data',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Create reproducible, governed model inputs from source data.',
    acceptanceCriteria:
      'Source data becomes versioned, quality-checked model features with lineage back to the source.',
    evidence: [
      'Source-to-feature pipeline',
      'Quality checks and versioned model input',
      'Feature lineage and reproducibility run',
    ],
  },
  {
    slug: 'model-training-compatibility',
    title: 'Training and bringing existing models',
    category: 'ML Guides',
    difficulty: 3,
    summary: 'Reproduce baseline model behavior in the target runtime.',
    acceptanceCriteria:
      'Train a model or bring an existing one, reproduce its baseline, and record what changed in code, libraries, and runtime.',
    evidence: [
      'Training or model-load run',
      'Baseline comparison within tolerance',
      'Runtime, library, and portability change log',
    ],
  },
  {
    slug: 'experiment-tracking',
    title: 'Reproducible experiments',
    category: 'ML Guides',
    difficulty: 3,
    summary: 'Replay a recorded experiment from tracked inputs.',
    acceptanceCriteria:
      'Rerun a tracked experiment from its recorded data, code, and environment and get the same result within tolerance.',
    evidence: [
      'Tracked experiment and environment references',
      'Reproduction run',
      'Tolerance comparison and variance notes',
    ],
  },
  {
    slug: 'real-time-scoring',
    title: 'Online model scoring',
    category: 'ML Guides',
    difficulty: 4,
    summary: 'Measure a secured online inference path under normal and failure conditions.',
    acceptanceCriteria:
      'Send a secured scoring request, measure latency, and see how the endpoint scales and handles failures.',
    evidence: [
      'Authenticated request and response',
      'Latency and scaling measurements',
      'Failure-mode behavior and recovery',
    ],
  },
  {
    slug: 'model-performance-drift',
    title: 'Model quality and drift',
    category: 'ML Guides',
    difficulty: 4,
    summary: 'Detect a simulated breach and route action to the owner.',
    acceptanceCriteria:
      'Track operational and model metrics, simulate drift, alert the owner, and follow the retraining workflow.',
    evidence: [
      'Operational and model metric view',
      'Simulated breach and owner alert',
      'Review or retraining workflow',
    ],
  },
  {
    slug: 'operational-support',
    title: 'Support and recovery',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary: 'Exercise support ownership and a representative recovery path.',
    acceptanceCriteria:
      'Triage an incident, restart or recover the workload, and follow the escalation path and ownership.',
    evidence: ['Triage and recovery exercise', 'Resiliency approach', 'Escalation path and ownership matrix'],
  },
  {
    slug: 'iceberg-support',
    title: 'Apache Iceberg interoperability',
    category: 'General Guides',
    difficulty: 4,
    summary: 'Validate governed Iceberg interoperability and table evolution.',
    acceptanceCriteria:
      'Read and write an Iceberg table, evolve its schema, use time travel, and query it from an external engine.',
    evidence: [
      'Representative read and write run',
      'Evolution and time-travel evidence',
      'Catalog and external access validation',
    ],
  },
  {
    slug: 'file-formats-delta-iceberg',
    title: 'JSON, CSV, Parquet, Delta, and Iceberg',
    category: 'General Guides',
    difficulty: 2,
    summary: 'Compare file and table formats on one dataset: size, types, query cost, and table-only features.',
    acceptanceCriteria:
      'Write one dataset as JSON, CSV, Parquet, Delta, and Iceberg, measure each, and show what only the table formats provide.',
    evidence: [
      'Size, inferred-type, and query-time table per format',
      'Update, time-travel, and schema-evolution runs on tables versus files',
      'Delta log and Iceberg metadata file listings',
    ],
  },
  {
    slug: 'external-integrations',
    title: 'Partner tool integrations',
    category: 'General Guides',
    difficulty: 3,
    summary: 'Connect two priority tools through supported integration patterns.',
    acceptanceCriteria: 'Connect two common tools to Databricks using supported connectors and patterns.',
    evidence: [
      'Two configured integrations',
      'Identity and connectivity pattern',
      'Successful end-to-end exchange runs',
    ],
  },
  {
    slug: 'legacy-conversion',
    title: 'Legacy workload migration',
    category: 'General Guides',
    difficulty: 5,
    summary: 'Assess conversion coverage and the remaining human effort.',
    acceptanceCriteria:
      'Assess one legacy workload, convert it automatically where possible, reconcile the results, and estimate the remaining effort by role.',
    evidence: [
      'Representative workload assessment',
      'Automated coverage and remediation log',
      'Test results and role-based effort estimate',
    ],
  },
  {
    slug: 'data-sharing',
    title: 'Governed data sharing',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary: 'Exercise governed sharing, entitlement, and revocation.',
    acceptanceCriteria:
      'Share a governed dataset, grant and revoke access, and decide whether the recipient needs a copy.',
    evidence: [
      'Governed share and recipient setup',
      'Entitlement and revocation run',
      'Replication requirement decision',
    ],
  },
  {
    slug: 'platform-administration',
    title: 'Workspace and account administration',
    category: 'Governance/Monitoring',
    difficulty: 4,
    summary: 'Walk through the core enterprise administration operating model.',
    acceptanceCriteria:
      'Set up workspaces and roles, apply policies, manage capacity, read audit logs, and handle routine support.',
    evidence: [
      'Workspace and account setup record',
      'Roles, policies, and capacity controls',
      'Audit access and routine support procedure',
    ],
  },
  {
    slug: 'file-format-ingestion',
    title: 'File format ingestion',
    category: 'Ingestion',
    difficulty: 2,
    summary: 'Land CSV, delimited text, Excel, JSON, and XML through one pipeline.',
    acceptanceCriteria:
      'CSV, pipe-delimited text with quoted delimiters, a named Excel sheet, nested JSON, and XML with repeating and optional nodes all land in Delta tables with types preserved and nothing dropped.',
    evidence: [
      'One table per format with row counts',
      'Rescued-data and type checks',
      'Pipeline run with every format',
    ],
  },
  {
    slug: 'rest-api-ingestion',
    title: 'Authenticated REST API ingestion',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Pull a paginated, authenticated API into Delta.',
    acceptanceCriteria:
      'A job calls a paginated REST endpoint with OAuth or an API key, follows pages until the end, refreshes tokens, and lands every record with the request log.',
    evidence: ['Paginated pull with token handling', 'Request log with page counts', 'Job run with total records'],
  },
  {
    slug: 'sftp-ingestion',
    title: 'SFTP file retrieval',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Fetch files from an SFTP server and ingest them.',
    acceptanceCriteria:
      'A job connects to an SFTP server with stored credentials, copies new files to a volume, and Auto Loader ingests them without reprocessing old files.',
    evidence: ['Credentials in a secret scope', 'Files copied to a volume', 'Ingested table and job run'],
  },
  {
    slug: 'multi-source-pipeline',
    title: 'Multi-source pipeline',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Combine database, file, and API sources in one pipeline.',
    acceptanceCriteria:
      'One Lakeflow Declarative Pipeline reads a database extract, landed files, and API output, tags each row with its source, and builds one conformed table.',
    evidence: [
      'Single pipeline graph with three sources',
      'source_system column on every row',
      'Pipeline update with row counts',
    ],
  },
  {
    slug: 'relational-db-ingestion',
    title: 'Relational database extracts',
    category: 'Ingestion',
    difficulty: 2,
    summary: 'Full extracts and custom SQL from a relational database.',
    acceptanceCriteria:
      'A full table extract and a custom query with joins, aggregates, window functions, and a database function land in Delta and match the same query run at the source.',
    evidence: ['Full extract with types preserved', 'Custom SQL result matching the source', 'Run log with row counts'],
  },
  {
    slug: 'sqlserver-lakeflow-connect',
    title: 'SQL Server connections with Lakeflow Connect',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'A Unity Catalog connection, a gateway and a serverless pipeline, and CDC or Change Tracking per table. Needs classic compute for the gateway.',
    acceptanceCriteria:
      'A Lakeflow Connect gateway and ingestion pipeline land three SQL Server tables, one with SCD type 2 history. Inserts, updates, and deletes made on the source show up in bronze, a new source column flows through with no pipeline change, a full refresh of one table leaves the history table intact, and silver tables show lineage and answer a Genie question.',
    evidence: [
      'Change Tracking or CDC per table, checked on the source',
      'Every source insert, update, and delete found in bronze',
      'Schema change and single-table full refresh with history kept',
      'Lineage to silver and a Genie answer matching SQL',
    ],
  },
  {
    slug: 'transformation-patterns',
    title: 'Transformation patterns',
    category: 'Data Engineering Guides',
    difficulty: 2,
    summary: 'Ten common ETL patterns as declarative SQL.',
    acceptanceCriteria:
      'Lookups, joins, string functions, null handling, date and time zones, casting with a reject path, running totals, pivots, last record per group, and per-group iteration, each as a materialized view.',
    evidence: [
      'One materialized view per pattern',
      'Reject table for failed casts',
      'Pipeline update covering all patterns',
    ],
  },
  {
    slug: 'scd-change-capture',
    title: 'SCD and change capture',
    category: 'Data Engineering Guides',
    difficulty: 3,
    summary: 'SCD type 1, type 2, and change detection with Auto CDC.',
    acceptanceCriteria:
      'New, changed, and deleted source records flow into an SCD type 1 table that overwrites and an SCD type 2 table that keeps history, without full reloads.',
    evidence: [
      'SCD type 1 and type 2 tables',
      'Deletes propagated or flagged',
      'Pipeline updates before and after changes',
    ],
  },
  {
    slug: 'cdc-incremental-refresh',
    title: 'CDC and incremental refresh in pipelines',
    category: 'Data Engineering Guides',
    difficulty: 4,
    summary: 'CDC from change files, a Delta change feed, and snapshots, and incremental versus full refresh.',
    acceptanceCriteria:
      'One serverless Lakeflow pipeline applies change data from Debezium-style files, the Delta change data feed, and a snapshot table with AUTO CDC. The job measures an incremental update, a full refresh, and a selective full refresh from the pipeline event log, including how the materialized view refreshes.',
    evidence: [
      'Three AUTO CDC targets from three source shapes',
      'Rows written per dataset for each refresh mode',
      'Materialized view maintenance type and stream offsets from the event log',
    ],
  },
  {
    slug: 'target-loading-outputs',
    title: 'Target loading and file outputs',
    category: 'Data Engineering Guides',
    difficulty: 2,
    summary: 'Upsert to a target table and write CSV, Excel, and JSON files.',
    acceptanceCriteria:
      'A job merges inserts, updates, and deletes into a target table, then writes the result as CSV, pipe-delimited text, an Excel workbook, and JSON to a volume.',
    evidence: [
      'MERGE with insert, update, and delete counts',
      'Four output files in a volume',
      'Job run with file sizes',
    ],
  },
  {
    slug: 'orchestration-patterns',
    title: 'Orchestration patterns',
    category: 'Data Engineering Guides',
    difficulty: 3,
    summary: 'Chain, parallelize, schedule, retry, alert, and pause jobs.',
    acceptanceCriteria:
      'One Lakeflow Job shows sequential tasks with passed values, parallel branches, a schedule, retries, success and failure alerts, a call to an external process, and a bulk pause of scheduled jobs.',
    evidence: [
      'Job graph with sequential and parallel tasks',
      'Retry and alert settings',
      'Bulk pause and resume record',
    ],
  },
  {
    slug: 'data-observability',
    title: 'Lineage and drift detection',
    category: 'Data Engineering Guides',
    difficulty: 3,
    summary: 'Trace lineage, catch schema drift, and flag data drift.',
    acceptanceCriteria:
      'Lineage from source to report comes from system tables, schema changes are detected from Delta history, and a monitor flags a shift in a column distribution.',
    evidence: [
      'End-to-end lineage query',
      'Schema drift report from table history',
      'Data drift result from a monitor',
    ],
  },
  {
    slug: 'sql-notebook-analysis',
    title: 'SQL and notebooks at scale',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Explore with SQL, Python, and R notebooks, including large data.',
    acceptanceCriteria:
      'Analysts query with SQL, round-trip to pandas in a Python notebook, use R, and aggregate millions of rows on serverless compute in seconds.',
    evidence: ['SQL exploration queries', 'Python and R notebooks', 'Large aggregation with timing'],
  },
  {
    slug: 'bring-your-own-data',
    title: 'Bring your own data',
    category: 'Analyst Guides',
    difficulty: 1,
    summary: 'Upload a spreadsheet and join it to governed tables.',
    acceptanceCriteria:
      'A user uploads a file to a personal volume path, joins it to governed tables, and keeps unmatched keys visible.',
    evidence: ['Uploaded file in a volume', 'Join result with match counts', 'Per-user upload location'],
  },
  {
    slug: 'local-tool-connectivity',
    title: 'Connecting local tools',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Reach Databricks from Python, R, and statistics tools on a laptop.',
    acceptanceCriteria:
      'Python, R, and ODBC/JDBC clients on a workstation connect with OAuth, query governed tables, and respect the same permissions as the workspace.',
    evidence: ['Connection examples per tool', 'OAuth sign-in steps', 'Query result from a local client'],
  },
  {
    slug: 'no-code-data-prep',
    title: 'No-code data preparation',
    category: 'Analyst Guides',
    difficulty: 1,
    summary: 'Browse, filter, transform, and save flows without code.',
    acceptanceCriteria:
      'A business user browses tables, filters and joins with Lakeflow Designer, renames and derives columns, and saves the flow to rerun later.',
    evidence: ['Saved visual flow', 'Output table from the flow', 'Steps a non-coder can follow'],
  },
  {
    slug: 'self-service-extracts',
    title: 'Self-service extracts and subscriptions',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Subscribe to reports and export data to Excel or flat files.',
    acceptanceCriteria:
      'Users subscribe to a scheduled dashboard, export filtered data to Excel or CSV, and write a formatted workbook or delimited file for external partners.',
    evidence: ['Dashboard subscription', 'Excel and CSV exports', 'Delimited file in a volume'],
  },
  {
    slug: 'in-platform-visualization',
    title: 'Charts and dashboards in the platform',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Chart in notebooks and publish an AI/BI dashboard.',
    acceptanceCriteria:
      'Notebook charts and an AI/BI dashboard read the same governed views, so a chart and its dashboard tile show the same numbers.',
    evidence: ['Notebook charts', 'Published AI/BI dashboard', 'Shared governed views'],
  },
  {
    slug: 'access-management',
    title: 'Access management',
    category: 'Governance/Monitoring',
    difficulty: 2,
    summary: 'Groups, environments, object permissions, and service principals.',
    acceptanceCriteria:
      'Users get access through groups, dev and prod catalogs grant different privileges, object-level grants are audited, and service principals hold credentials for automation.',
    evidence: ['Group-based grants', 'Dev versus prod access difference', 'Permission audit query'],
  },
  {
    slug: 'row-column-security',
    title: 'Row and column security',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary: 'Mask columns and filter rows by user, then test the policies.',
    acceptanceCriteria:
      'Column masks hide sensitive fields, row filters limit rows by attribute and identity, and a second identity confirms the policies apply before they are documented.',
    evidence: [
      'Column masks and row filters',
      'Results as two different identities',
      'Policy inventory from information_schema',
    ],
  },
  {
    slug: 'compute-capacity-management',
    title: 'Compute and capacity management',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary: 'Size, scale, isolate, pause, and monitor compute.',
    acceptanceCriteria:
      'Warehouses scale up and out, auto-stop when idle, isolate workloads, and a utilization dashboard shows queueing and peak concurrency.',
    evidence: [
      'Warehouse sizing and autoscale settings',
      'Workload isolation layout',
      'Capacity dashboard over query history',
    ],
  },
  {
    slug: 'cost-chargeback',
    title: 'Cost tracking and chargeback',
    category: 'Governance/Monitoring',
    difficulty: 2,
    summary: 'Spend by product, team, and workload, with budgets and forecasts.',
    acceptanceCriteria:
      'Usage system tables break spend down by product, tag, user, and pipeline, budgets alert on thresholds, and a forecast projects the next 30 days.',
    evidence: ['Spend by product and tag', 'Budget alert', 'Forecast and optimization queries'],
  },
];

export function getGuide(slug: string | undefined) {
  return guides.find((guide) => guide.slug === slug);
}
