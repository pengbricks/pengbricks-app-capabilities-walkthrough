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
      'Data lives in open-format tables in your storage, compute is serverless and separate, and Unity Catalog governs both. Default to managed tables with predictive optimization, serverless compute, and tagged cost attribution.',
    evidence: [
      'Control plane, compute plane, and storage layout',
      'One table read by several engines without a copy',
      'Compute and storage billed separately, with spend attributed by tag',
    ],
  },
  {
    slug: 'unity-catalog-basics',
    title: 'Unity Catalog basics',
    category: 'Foundations',
    difficulty: 1,
    summary: 'Catalogs, schemas, and tables: how every object is named, found, and granted.',
    acceptanceCriteria:
      'Objects are named catalog.schema.object, managed by Unity Catalog, owned by groups or service principals, and granted to groups at the least privilege. Environments are separate catalogs bound to workspaces, and lineage and audit come from system tables.',
    evidence: [
      'Metastore, catalog, schema, and object hierarchy',
      'Group grants with least privilege and tag-based policies',
      'Catalog per environment, volumes instead of mounts, and system-table audit',
    ],
  },
  {
    slug: 'medallion-architecture',
    title: 'Medallion architecture',
    category: 'Foundations',
    difficulty: 1,
    summary: 'Bronze, silver, and gold: raw data in, cleaned data in the middle, business tables out.',
    acceptanceCriteria:
      'Raw records land in bronze, silver is cleaned and deduplicated with AUTO CDC, and gold is a view, materialized view, or metric view that suits how it is read. Expectations choose warn, drop, or fail per rule, and a quarantine table holds rows that need review.',
    evidence: [
      'What each layer holds and who reads it',
      'Expectation actions and a quarantine pattern between layers',
      'Liquid clustering and the choice of gold object',
    ],
  },
  {
    slug: 'configuration-vs-code',
    title: 'Metadata-driven ingestion',
    category: 'Ingestion',
    difficulty: 4,
    summary: 'Describe sources in configuration, run them through shared code, and use native Lakeflow features before a custom runner.',
    acceptanceCriteria:
      'Per-source differences live in validated configuration and, where unavoidable, a narrow adapter. Validation, upserts, and fan-out use expectations, AUTO CDC, and for_each. Rejected rows are quarantined with the failed rule, and every run is audited.',
    evidence: [
      'Boundary between configuration, adapter, and shared code',
      'Native expectations, AUTO CDC, and for_each in place of a custom runner',
      'Quarantine, audit, and alerting on the reject rate',
    ],
  },
  {
    slug: 'reusability-templatization',
    title: 'Reusable ingestion templates',
    category: 'Ingestion',
    difficulty: 4,
    summary: 'Parameterize and template ingestion so a new source, tenant, or environment is a configuration change.',
    acceptanceCriteria:
      'Parameters flow from bundle variables to job, task, for_each, and pipeline settings. Targets override per environment, shared code ships as a wheel, and new projects start from a bundle template.',
    evidence: [
      'Parameter layers from deploy to task',
      'Target overrides and run_as per environment',
      'Custom bundle template and shared wheel',
    ],
  },
  {
    slug: 'batch-real-time-ingestion',
    title: 'Batch and streaming ingestion',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Choose between triggered, continuous, and real-time mode by latency target and cost.',
    acceptanceCriteria:
      'The trigger mode follows the latency target. Files are discovered with file events, message buses and Zerobus are used where producers write events, checkpoints and watermarks keep state correct, and backfills are idempotent.',
    evidence: [
      'Trigger-mode decision with latency and cost trade-offs',
      'File events, message bus, and direct-write sources',
      'Checkpoint, watermark, and one-time backfill handling',
    ],
  },
  {
    slug: 'ide-developer-experience',
    title: 'Developer workflow in the IDE',
    category: 'CI/CD & Version Control Guides',
    difficulty: 3,
    summary: 'Develop, test, and package Databricks code from your IDE, with the same checks in CI.',
    acceptanceCriteria:
      'Code runs against serverless compute through Databricks Connect, logic lives in plain functions covered by pytest, shared code ships as a wheel in a bundle, and lint plus the same tests gate every pull request.',
    evidence: [
      'Databricks Connect against serverless with a pytest suite on plain functions',
      'Shared code packaged as a wheel with pyproject, from the default-python bundle template',
      'Git folders, lint and pre-commit, and the same tests running in CI',
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
    summary: 'Change a table schema without breaking readers, and retire old versions on a schedule.',
    acceptanceCriteria:
      'Nonbreaking changes use Delta type widening, column mapping, and schema evolution in place. NOT NULL and CHECK constraints protect the contract, views give readers a stable interface, Unity Catalog tags mark deprecations, and lineage and query history find the consumers.',
    evidence: [
      'Schema changes applied in place with type widening and column mapping',
      'Constraints and a view-based consumer interface, with OpenSharing for external readers',
      'Deprecation tags and consumer discovery from lineage and query history',
    ],
  },
  {
    slug: 'model-deployment-cicd',
    title: 'Model release pipeline',
    category: 'ML Guides',
    difficulty: 5,
    summary: 'Release models through test gates, approval, and an auditable alias change.',
    acceptanceCriteria:
      'A new model version passes test gates, gets approval in a protected environment, and is promoted by Unity Catalog alias or copy_model_version into the production catalog. Rollout uses a traffic split with Unity Gateway limits and inference tables, rollback is an alias move, and CI authenticates with GitHub OIDC.',
    evidence: [
      'Test gates, including MLflow 3 GenAI evaluation for LLM apps',
      'Approval through a protected environment and a catalog per environment',
      'Canary rollout, rollback by alias, and a release record',
    ],
  },
  {
    slug: 'dataops',
    title: 'Pipeline operations',
    category: 'CI/CD & Version Control Guides',
    difficulty: 3,
    summary: 'Run pipelines with safe retries, targeted alerts, and tested recovery.',
    acceptanceCriteria:
      'Tasks are idempotent, so retries and repair runs are safe. Failures and slow runs notify the owner through Slack, PagerDuty, or a webhook, system tables and SQL alerts track trends, concurrency and timeouts limit overlap, and recovery uses RESTORE within retention plus deep clone backups.',
    evidence: [
      'Idempotent writes with retry and repair settings',
      'Notification destinations, health rules, and system table alerts',
      'Concurrency and timeout limits, recovery with RESTORE and deep clone, and a runbook',
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
      'Pick the right AI Function for a task, run it once over a table and keep the result, and check the models, permissions, data residency, and compliance settings that apply before it touches regulated data.',
    evidence: [
      'Use cases with the function and SQL for each',
      'Decision table: task function, ai_query, or hand-built',
      'Model, permission, residency, and compliance checklist',
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
    summary: 'Create governed, point-in-time-correct model inputs from source data.',
    acceptanceCriteria:
      'Features live in Unity Catalog feature tables with a primary key and timestamp, pass quality checks before use, join to labels as of each label time, and are logged with the model. Reproducibility beyond the VACUUM retention window uses a snapshot or clone.',
    evidence: [
      'Governed feature table refreshed by MERGE',
      'Point-in-time training set logged with the model',
      'Snapshot or clone for long-lived reproducibility, and feature lineage',
    ],
  },
  {
    slug: 'model-training-compatibility',
    title: 'Training and bringing existing models',
    category: 'ML Guides',
    difficulty: 3,
    summary: 'Log models that others can load, validate, and reproduce in Unity Catalog.',
    acceptanceCriteria:
      'Models are logged with a signature, input example, and pinned requirements, validated with mlflow.models.predict, and saved in a format that does not run code on load where possible. They register with aliases, and Feature Views keep training and serving features the same.',
    evidence: [
      'Signature, input example, and pinned requirements on every logged model',
      'Pre-registration validation and a baseline comparison',
      'Safer formats, workspace registry migration, and Feature Views',
    ],
  },
  {
    slug: 'experiment-tracking',
    title: 'Reproducible experiments',
    category: 'ML Guides',
    difficulty: 3,
    summary: 'Record the data, code, and environment behind each run so it can be replayed.',
    acceptanceCriteria:
      'Each run logs its dataset with mlflow.data and mlflow.log_input, plus the Git commit, parameters, seed, and pinned environment. A rerun built from that record matches the original metric within a tolerance, as long as Delta retention keeps the data version.',
    evidence: [
      'Dataset lineage from mlflow.log_input, not tags',
      'Git commit, autologging, seeds, and pinned requirements',
      'Tolerance comparison and Delta retention settings',
    ],
  },
  {
    slug: 'real-time-scoring',
    title: 'Online model scoring',
    category: 'ML Guides',
    difficulty: 4,
    summary: 'Serve a model online with secured access, limits, and a measured scaling plan.',
    acceptanceCriteria:
      'Callers use OAuth with CAN QUERY, Unity Gateway sets rate limits and logs requests to inference tables, features come from an online store, and the endpoint is sized from a load test and watched with metrics and alerts.',
    evidence: [
      'OAuth access and CAN QUERY permissions',
      'Scaling choices, rate limits, and traffic split',
      'Load-test method and endpoint monitoring',
    ],
  },
  {
    slug: 'model-performance-drift',
    title: 'Model quality and drift',
    category: 'ML Guides',
    difficulty: 4,
    summary: 'Detect input drift and quality loss with data quality monitoring, and act on it.',
    acceptanceCriteria:
      'An inference profile tracks drift and quality over time windows, labels join with their delay, and SQL alerts notify the owner. A breach starts retraining that registers a challenger, and a person reviews it before promotion.',
    evidence: [
      'Inference profile with profile and drift tables and a generated dashboard',
      'Late label join and a SQL alert in Lakeflow Jobs',
      'Retraining trigger and reviewed champion promotion',
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
    summary: 'Land CSV, delimited text, Excel, JSON, XML, and documents with one pattern.',
    acceptanceCriteria:
      'Each format loads with the options it needs, new files are found with file events, schema drift is handled with hints, evolution modes, and rescued data, volatile JSON lands as Variant, and documents are parsed with ai_parse_document.',
    evidence: [
      'Format options and read_files versus Auto Loader choice',
      'Schema evolution modes and rescued data',
      'Row count, type, and rescued-data verification',
    ],
  },
  {
    slug: 'rest-api-ingestion',
    title: 'Authenticated REST API ingestion',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Choose a managed connector, a Python data source, or land-then-Auto-Loader, and pull APIs reliably.',
    acceptanceCriteria:
      'A managed Lakeflow Connect connector is used when one exists. Otherwise a custom connector, Python data source, or raw landing feeds Delta. Credentials stay in Unity Catalog connections or secrets, pulls are incremental with a stored cursor and MERGE, and retries follow the status code.',
    evidence: [
      'Ingestion options ranked by effort and control',
      'Credentials in connections, service credentials, or secret scopes',
      'Retry and backoff rules, incremental cursor, and idempotent upsert',
    ],
  },
  {
    slug: 'sftp-ingestion',
    title: 'SFTP file retrieval',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Ingest files from an SFTP server with the Lakeflow Connect SFTP connector.',
    acceptanceCriteria:
      'A Unity Catalog SFTP connection with a PEM private key and Auto Loader ingest files incrementally. The server allows the compute egress addresses. A copy-to-volume job is used only when the connector does not fit.',
    evidence: [
      'SFTP connection with private-key authentication and grants',
      'Network allow-listing for classic or serverless compute',
      'Copy-then-ingest fallback with a transfer log',
    ],
  },
  {
    slug: 'multi-source-pipeline',
    title: 'Multi-source pipeline',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'Conform database, file, and API sources into one schema and resolve duplicate entities.',
    acceptanceCriteria:
      'Each source has a staging table with its own expectations. Append flows write to one streaming table with a source_system column, and entity resolution with survivorship rules produces one record per entity and a crosswalk to source records.',
    evidence: [
      'Staging table per source feeding one conformed table',
      'source_system and source_id on every row',
      'Resolution and survivorship rules with a crosswalk',
    ],
  },
  {
    slug: 'relational-db-ingestion',
    title: 'Relational database extracts',
    category: 'Ingestion',
    difficulty: 2,
    summary: 'Choose Lakehouse Federation, Lakeflow Connect CDC, or a query-based connector for a relational source.',
    acceptanceCriteria:
      'The ingestion path follows freshness, volume, and source-load needs: Federation to query in place, CDC connectors for continuous replication, query-based connectors for scheduled pulls with a cursor column. Landed data is verified against the source by count, checksum, and type.',
    evidence: [
      'Decision between Federation, CDC, and query-based connectors',
      'Pushdown of joins and aggregates to the source',
      'Count, checksum, and type comparison with the source',
    ],
  },
  {
    slug: 'sqlserver-lakeflow-connect',
    title: 'SQL Server connections with Lakeflow Connect',
    category: 'Ingestion',
    difficulty: 3,
    summary: 'A Unity Catalog connection, a gateway and a serverless pipeline, and CDC or Change Tracking per table. The gateway needs classic compute.',
    acceptanceCriteria:
      'A Lakeflow Connect gateway and ingestion pipeline replicate SQL Server tables, with SCD type 2 history where needed. Inserts, updates, and deletes reach bronze, schema changes flow through, a single-table full refresh keeps history tables intact, and the pipelines run as a service principal with monitoring and alerts.',
    evidence: [
      'Change Tracking or CDC chosen per table and verified on the source',
      'Inserts, updates, and deletes applied to bronze',
      'Schema change and single-table full refresh with history kept',
      'Lineage to silver, monitoring, and run_as',
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
