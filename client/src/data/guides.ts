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
    slug: 'create-catalog',
    title: 'Create a catalog',
    category: 'Foundations',
    difficulty: 1,
    summary: 'Who can create a catalog, where it stores data, and how to name, grant, and bind one per environment.',
    acceptanceCriteria:
      'Catalogs are named <environment>_<domain>, created by someone with CREATE CATALOG, given a managed location where storage must be separate, owned by a group, granted USE CATALOG and CREATE SCHEMA to builders, and bound to the workspaces that should see them.',
    evidence: [
      'Privileges needed to create standard, foreign, and shared catalogs',
      'Inherited storage versus a managed location per catalog',
      'Catalog Explorer, SQL, CLI, and bundle options with grants and bindings',
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
    summary:
      'Describe sources in configuration, run them through shared code, and use native Lakeflow features before a custom runner.',
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
    slug: 'vscode-databricks',
    title: 'Working with Databricks in VS Code',
    category: 'CI/CD & Version Control Guides',
    difficulty: 2,
    summary:
      'Set up the Databricks extension with OAuth, work from a bundle, and run, debug, and test code against serverless or a cluster.',
    acceptanceCriteria:
      'The extension signs in with an OAuth profile, never a personal access token. The project is a bundle with a chosen target, and deploys and runs go through the Bundle Resource Explorer. Code is debugged with Databricks Connect in a virtual environment that matches the compute, with databricks-connect pinned to that version, and pytest runs from the test explorer. Code does not depend on local-only paths such as dbutils.',
    evidence: [
      'OAuth profile, bundle target, and compute selected in the Configuration view',
      'Bundle deploy and run from the Resource Explorer, and a debugged file or notebook cell',
      'Virtual environment built from the compute, a pinned databricks-connect, and a passing pytest run',
    ],
  },
  {
    slug: 'git-collaboration',
    title: 'Collaborating on Databricks projects with Git',
    category: 'CI/CD & Version Control Guides',
    difficulty: 2,
    summary:
      'Work in personal Git folders on short-lived branches, review through pull requests, and deploy through CI.',
    acceptanceCriteria:
      'Each person works in their own Git folder or IDE clone on a short-lived branch. Git credentials use the Databricks GitHub app or OAuth where available, and automation uses service principal credentials. Main is protected with required review and checks, notebooks are committed without outputs, secrets, or data, and shared and production code deploys only through CI and bundles, never from a hand-edited folder.',
    evidence: [
      'Git credential setup with the GitHub app and a service principal credential for automation',
      'Branch, pull request, required checks, and CODEOWNERS on main',
      'Notebook format choice, .gitignore, and output-commit settings',
    ],
  },
  {
    slug: 'dab-starter',
    title: 'Running a Declarative Automation Bundle',
    category: 'CI/CD & Version Control Guides',
    difficulty: 2,
    summary: 'Download a starter bundle, push it to your Git repo, then validate, deploy, and run it with the CLI.',
    acceptanceCriteria:
      'A starter bundle is downloaded, pushed to your own Git repo, validated, deployed to a development target, and run. A serverless Lakeflow Spark Declarative Pipeline builds bronze, silver, and gold tables from synthetic orders. The same bundle then deploys to a prod target and is destroyed cleanly.',
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
    summary:
      'Author in Git folders or an IDE, deploy with bundles from CI, and promote one commit through environments with approvals.',
    acceptanceCriteria:
      'People author on short-lived branches in their own Git folders or IDE clones, and production runs from bundle deployments made by CI, never from a hand-edited Git folder. A pull request runs unit tests and bundle validate --strict, a merge deploys the commit to dev, and approvals promote the same commit through the later environments. A service principal deploys over GitHub OIDC with no stored secret, the CLI version is pinned, and every resource carries the release SHA.',
    evidence: [
      'Pull request checks, and one commit deployed to dev and test through the bundle',
      'Approval on a GitHub environment and a release tag on every resource',
      'OIDC sign-in for a service principal, with variables and targets instead of copies',
    ],
  },
  {
    slug: 'environment-workspaces-catalogs',
    title: 'Workspaces and catalogs across dev, test, stage, and prod',
    category: 'CI/CD & Version Control Guides',
    difficulty: 3,
    summary:
      'Lay out workspaces, catalogs, bindings, and identities for four environments, and audit a real catalog against the layout.',
    acceptanceCriteria:
      "Three catalog layouts are compared side by side, with the three-level table name each one gives. A bundle deploys dev, test, stage, and prod targets, and a job reads the catalog's isolation mode, workspace bindings, owner, and grants and reports what a layout check finds. The four-catalog setup is shown as SQL and CLI commands.",
    evidence: [
      'Workspace and catalog layout comparison with bundle variable mapping',
      'Audit run with isolation, binding, ownership, and grant findings',
      'Setup commands for catalogs, bindings, and grants',
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
    summary:
      'Keep data documentation in Unity Catalog: comments, governed tags, lineage, and quality, drafted with AI and approved by owners.',
    acceptanceCriteria:
      'Tables carry reviewed comments, governed and certification tags, and a group owner in Unity Catalog. AI drafts are proposed first and applied only after owner review, and never overwrite a human comment. Lineage and quality come from platform features.',
    evidence: [
      'Table and column comments, governed tags, and certification status',
      'Propose-then-approve flow for AI-drafted comments',
      'Lineage and data quality monitoring linked from the documentation',
    ],
  },
  {
    slug: 'monitoring',
    title: 'Platform observability',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary:
      'Answer operational, cost, and audit questions from system tables, and alert through Lakeflow Jobs notifications and Budgets.',
    acceptanceCriteria:
      'Each question maps to a system table (audit, billing, lakeflow, compute, query history, Unity Gateway usage) that is exposed through views with the right scope. Job failures and slow runs notify the owner, Budgets alert on spend, and retention, lag, and masking are known.',
    evidence: [
      'Question-to-system-table map',
      'Job notifications, health rules, and notification destinations',
      'Scope, retention, lag, and masking rules for system tables',
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
    slug: 'document-processing',
    title: 'Document processing pipelines and their cost',
    category: 'AI Guides',
    difficulty: 3,
    summary:
      'Land, parse, classify, extract, validate, and mask documents at volume, then price the pipeline from a measured sample.',
    acceptanceCriteria:
      'Documents land in a Unity Catalog volume and are ingested incrementally, parsed once and stored, classified and routed by type, extracted against a schema, validated with a quarantine path for a reviewer, masked before sharing, and priced from billed usage on a representative sample, extrapolated with growth and reprocessing allowances.',
    evidence: [
      'Incremental landing and a parsed table, with no page parsed twice',
      'Classification, schema extraction, and a quarantine table for doubtful results',
      'Cost per page and per document read from system.billing.usage, with the extrapolation shown',
    ],
  },
  {
    slug: 'user-experience',
    title: 'Assistant user experience',
    category: 'AI Guides',
    difficulty: 2,
    summary: 'Roll out a Genie Agent that business users trust: curate, measure, pilot, and distribute.',
    acceptanceCriteria:
      'A Genie Agent is curated with instructions, sample questions, and trusted assets, scored with benchmarks, piloted with a small cohort, and shared with the right access and warehouse size.',
    evidence: [
      'Instructions, sample questions, and trusted assets for the agent',
      'Benchmark set and accuracy score before wider release',
      'Feedback review routine, pilot training, and distribution channels',
    ],
  },
  {
    slug: 'ontology',
    title: 'Business terms and synonyms',
    category: 'AI Guides',
    difficulty: 2,
    summary:
      'Define business terms once with metric views, governed tags, and comments so people and Genie read data the same way.',
    acceptanceCriteria:
      'Business terms and synonyms are defined once in metric views, comments, and governed tags, trusted assets are certified, and Genie benchmarks show how well questions are interpreted.',
    evidence: [
      'Metric view with measures, dimensions, and synonyms',
      'Governed tags, reviewed comments, and certified assets',
      'Benchmark scores before and after a change to the semantics',
    ],
  },
  {
    slug: 'genie-agents',
    title: 'Genie Agents: setup, instructions, and data handling',
    category: 'AI Guides',
    difficulty: 2,
    summary:
      'Create a Genie Agent, write the instructions that make it accurate, and know which compute, identity, and stored data sit behind each answer.',
    acceptanceCriteria:
      'A Genie Agent is scoped to one domain over curated tables or a metric view, with definitions in SQL and short text instructions. It runs on a serverless SQL warehouse sized for concurrency, answers with each asker’s Unity Catalog permissions, and is versioned in a bundle and tested as a non-admin before rollout.',
    evidence: [
      'Metric view, example SQL, and a short text instruction with a trigger and an action',
      'Serverless warehouse, least-privilege grants, and a tested non-admin run',
      'Stored conversation fields, query history by asker and warehouse, and a bundle definition',
    ],
  },
  {
    slug: 'agent-framework-support',
    title: 'Agents, MCP, and model gateway',
    category: 'AI Guides',
    difficulty: 5,
    summary:
      'Host MCP servers and agents on Databricks Apps, govern tools and models through Unity Gateway, and trace and evaluate runs.',
    acceptanceCriteria:
      'MCP servers and agents run on Databricks Apps with the right identity (app or on-behalf-of user), tools are governed through Unity Gateway and Unity Catalog, models are routed with limits and fallback, and runs are traced and evaluated with MLflow.',
    evidence: [
      'Governed MCP tool call under Unity Catalog permissions',
      'Model service with routing, fallback, rate limits, and audit',
      'MLflow tracing, mlflow.genai.evaluate scores, and a status table of GA, Beta, and Legacy options',
    ],
  },
  {
    slug: 'agent-build-deployment',
    title: 'Building and shipping agents',
    category: 'AI Guides',
    difficulty: 5,
    summary: 'Build with the Agent Bricks CLI, deploy to Agent Runtime on Apps, and promote only after evaluation.',
    acceptanceCriteria:
      'An agent is built with the Agent Bricks CLI and deployed to Agent Runtime on Databricks Apps with DurableAgentServer, evaluated before promotion, traced in production, and released with every dependency and resource declared.',
    evidence: [
      'Agent project with agent.toml and pinned dependencies',
      'Evaluation scores that gate promotion, and production tracing',
      'Release record with resources, identity, and owners',
    ],
  },
  {
    slug: 'omnigent',
    title: 'Omnigent: coding agents with shared sessions and policies',
    category: 'AI Guides',
    difficulty: 3,
    summary:
      'Run coding agents through one server with shared sessions and enforced policies, using the managed service on Databricks or a self-managed deployment on Apps.',
    acceptanceCriteria:
      'Coding agents run through Omnigent on Databricks, with the managed service as the default and a self-managed deployment on Databricks Apps only for needs it does not cover. Each user connects with their own OAuth identity, models route through Unity Gateway, traces go to MLflow Tracing, and policies set cost budgets, repo allowlists, approval gates, and blast-radius limits at the session, agent, and server levels.',
    evidence: [
      'Server-wide policies for cost budget, repo allowlist, and blast radius',
      'Per-user Databricks connection, with models through Unity Gateway and traces in MLflow Tracing',
      'Shared session on a sandbox host, with MCP tools limited to an allowlist',
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
    summary: 'Make workloads recoverable, and give every incident a severity, an owner, and an escalation path.',
    acceptanceCriteria:
      'Tasks retry safely with idempotent writes, run_if handles cleanup, and repair runs finish failed work. Streams restart on their own, notifications reach the owner, disaster recovery has RPO and RTO targets, and runbooks define severity and escalation.',
    evidence: [
      'Retry, run_if, and repair settings for idempotent tasks',
      'Notifications, health rules, and destinations by severity',
      'Disaster recovery plan, runbooks, and escalation path',
    ],
  },
  {
    slug: 'iceberg-support',
    title: 'Apache Iceberg interoperability',
    category: 'General Guides',
    difficulty: 4,
    summary:
      'Use managed Iceberg, the Unity Catalog Iceberg REST catalog, and credential vending for governed interoperability.',
    acceptanceCriteria:
      'A managed Iceberg table, or a Delta table with Iceberg reads, is chosen for the use case and read by an external engine through the Iceberg REST catalog with vended credentials and a service principal on OAuth M2M.',
    evidence: [
      'Choice of managed Iceberg, Iceberg reads, or foreign Iceberg, with the reason',
      'External read through the REST catalog with least-privilege grants',
      'Schema evolution, time travel, and sharing approach',
    ],
  },
  {
    slug: 'file-formats-delta-iceberg',
    title: 'JSON, CSV, Parquet, Delta, and Iceberg',
    category: 'General Guides',
    difficulty: 2,
    summary:
      'Choose a format by use: Delta by default, Iceberg reads for interop, managed Iceberg when Iceberg is the contract.',
    acceptanceCriteria:
      'Raw files are ingested into Delta, tables are Unity Catalog managed with liquid clustering and predictive optimization, retention is set deliberately, and the format choice for each consumer is explained.',
    evidence: [
      'Format decision for each consumer: Delta, Iceberg reads, or managed Iceberg',
      'Ingestion of raw files into Delta with Auto Loader or read_files',
      'Clustering, maintenance, and VACUUM retention settings',
    ],
  },
  {
    slug: 'external-integrations',
    title: 'Partner tool integrations',
    category: 'General Guides',
    difficulty: 3,
    summary:
      'Choose the integration pattern for each tool: SQL warehouse, Federation, Lakeflow Connect, sharing, or Lakebase.',
    acceptanceCriteria:
      'Each priority tool connects through the pattern that fits it, with OAuth identity and Unity Catalog governance, and the choice between query in place, ingest, and share is explained.',
    evidence: [
      'Pattern chosen for each tool, with the reason',
      'OAuth identity and least-privilege grants for each connection',
      'End-to-end exchange through the chosen path',
    ],
  },
  {
    slug: 'geospatial-analytics',
    title: 'Geospatial analytics',
    category: 'General Guides',
    difficulty: 3,
    summary:
      'Load GIS data as native GEOMETRY, join assets to zones and events, aggregate by H3, and tie inspection documents to geometry.',
    acceptanceCriteria:
      'GIS files load into governed Delta tables with a known SRID and valid geometry. Zone membership, proximity, and nearest-asset questions are answered with ST_ functions, with H3 used as a prefilter or an aggregation key where it fits. Inspection documents are parsed and joined to asset geometry, results are mapped or exported, and access is limited by district.',
    evidence: [
      'Source formats, SRIDs, and the metric projection used for distance',
      'Spatial joins scored against known answers',
      'Parsed inspection fields joined to asset geometry',
      'Map or GIS export, and the grants and row filter on geometry tables',
    ],
  },
  {
    slug: 'legacy-conversion',
    title: 'Legacy workload migration',
    category: 'General Guides',
    difficulty: 5,
    summary: 'Migrate with Lakebridge: assess, convert, and reconcile against the legacy system, in phases.',
    acceptanceCriteria:
      'One legacy workload is assessed, converted with automated tooling, reconciled against the legacy system’s own output, and landed on set-based SQL and Lakeflow patterns, with an effort estimate by role and a phased plan.',
    evidence: [
      'Assessment from the Profiler and Analyzer, with a prioritized inventory',
      'Converted code, flagged constructs, and the remediation log',
      'Reconciliation against legacy output and a phase plan through decommission',
    ],
  },
  {
    slug: 'data-sharing',
    title: 'Governed data sharing',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary:
      'Share governed data and AI assets with OpenSharing, using the right recipient type, credential hardening, and audit.',
    acceptanceCriteria:
      'A share exposes only the intended assets, and a view carries any row or column restriction. Open recipients use OIDC federation or short-lived tokens with an IP access list, access can be revoked, cross-region egress is planned for, and sharing is audited through system tables.',
    evidence: [
      'Recipient type choice and required privileges',
      'Open-recipient hardening and shareable asset types',
      'Egress plan and audit query',
    ],
  },
  {
    slug: 'platform-administration',
    title: 'Workspace and account administration',
    category: 'Governance/Monitoring',
    difficulty: 4,
    summary:
      'Run the account and workspaces with one identity source, regional metastores, and administration kept in code.',
    acceptanceCriteria:
      'Identity syncs to the account and grants go to account groups. Automation uses service principals with OAuth or federation, and PATs are restricted. Network, encryption, and serverless controls are set early, and the platform is managed in Terraform and bundles with system tables enabled.',
    evidence: [
      'Account, metastore, and workspace-catalog binding model',
      'Identity, credential, and PAT policy',
      'Network, serverless, and compute controls managed as code',
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
    summary:
      'A Unity Catalog connection, a gateway and a serverless pipeline, and CDC or Change Tracking per table. The gateway needs classic compute.',
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
    summary: 'Declarative SQL transformations that update incrementally.',
    acceptanceCriteria:
      'Transformations are Lakeflow Spark Declarative Pipelines with the right dataset type for each step. Production runs update incrementally, not by full refresh. Expectations enforce quality, try_cast pairs with a reject path, and the ten common patterns use built-in SQL.',
    evidence: [
      'Streaming tables for ingest, materialized views for transforms',
      'Incremental updates on serverless; full refresh only for logic changes',
      'Expectations and a reject path for bad values',
    ],
  },
  {
    slug: 'scd-change-capture',
    title: 'SCD and change capture',
    category: 'Data Engineering Guides',
    difficulty: 3,
    summary: 'SCD type 1 and type 2 with AUTO CDC.',
    acceptanceCriteria:
      'Change feeds apply with AUTO CDC. Type 1 holds current state and type 2 holds history, chosen by the question asked. SEQUENCE BY orders late events, deletes are declared in the flow, and TRACK HISTORY limits versions to columns that matter. Updates are incremental, not full reloads.',
    evidence: [
      'Type 1 versus type 2 chosen by use',
      'SEQUENCE BY ordering and APPLY AS DELETE',
      'TRACK HISTORY on meaningful columns, and a point-in-time query',
    ],
  },
  {
    slug: 'cdc-incremental-refresh',
    title: 'CDC and incremental refresh in pipelines',
    category: 'Data Engineering Guides',
    difficulty: 4,
    summary: 'CDC from files, a change feed, and snapshots, with incremental refresh as the default.',
    acceptanceCriteria:
      'AUTO CDC applies change data from files, the Delta change data feed, and snapshots in a serverless Lakeflow Spark Declarative Pipeline. Normal updates are incremental. A full refresh is deliberate, protects raw tables with pipelines.reset.allowed = false, and prefers a selective refresh. Expectations validate the feed.',
    evidence: [
      'AUTO CDC for each source shape',
      'Incremental update by default, selective full refresh when needed',
      'Pipeline event log used to confirm what each update read',
    ],
  },
  {
    slug: 'target-loading-outputs',
    title: 'Target loading and file outputs',
    category: 'Data Engineering Guides',
    difficulty: 2,
    summary: 'Pick the right write pattern and deliver files from volumes.',
    acceptanceCriteria:
      'Batch upserts use MERGE on a deduplicated source and a clustered key. Ordered change feeds use AUTO CDC, and slice replacement uses REPLACE WHERE. Large file outputs are written with Spark to a Unity Catalog volume and shared by grant or OpenSharing.',
    evidence: [
      'MERGE, AUTO CDC, or REPLACE WHERE chosen by the load',
      'Deduplicated source, clustered key, and checked MERGE metrics',
      'Spark-written files in a volume with a READ VOLUME grant',
    ],
  },
  {
    slug: 'orchestration-patterns',
    title: 'Orchestration patterns',
    category: 'Data Engineering Guides',
    difficulty: 3,
    summary: 'Compose, trigger, retry, and operate Lakeflow Jobs.',
    acceptanceCriteria:
      'Lakeflow Jobs pass task values, run independent tasks in parallel, branch with run_if and condition tasks, and loop with For each. Jobs start on table-update or file-arrival triggers when data drives them. Retries, timeouts, and notifications handle failure, repair runs rerun only what failed, and production jobs run as a service principal defined in a bundle.',
    evidence: [
      'Task values, parallel branches, run_if, and For each',
      'Data-driven triggers instead of polling schedules',
      'Retries, notifications, repair runs, and service principal ownership',
    ],
  },
  {
    slug: 'data-observability',
    title: 'Lineage and drift detection',
    category: 'Data Engineering Guides',
    difficulty: 3,
    summary: 'Lineage, schema drift, and data quality monitoring.',
    acceptanceCriteria:
      'Lineage comes from Unity Catalog system tables. Schema changes are read from Delta table history, with information_schema snapshots to watch many tables. Data quality monitoring covers freshness and completeness with anomaly detection and drift with data profiling on a schedule, with alerts. Pipeline expectations stop bad data at the source.',
    evidence: [
      'Lineage queries for impact analysis',
      'Schema changes from DESCRIBE HISTORY and scheduled snapshots',
      'Scheduled data profiling monitor with alerts',
    ],
  },
  {
    slug: 'data-validation-framework',
    title: 'Data validation framework',
    category: 'Data Engineering Guides',
    difficulty: 3,
    summary: 'Reconcile with the source, enforce rules with quarantine, and run every check from one spec into one results table.',
    acceptanceCriteria:
      'Validation logic is written once, in Databricks. The copy is reconciled with the source through Lakehouse Federation at the right grain. Row rules run as pipeline expectations with a quarantine table. All other checks run from one spec into one results table that drives an alert and can block downstream tasks. Lineage lists what a failure affects, and metric views hold the metric definitions.',
    evidence: [
      'Per-day counts, sums, and checksums compared with the source',
      'Quarantine table with the rule names and expectation metrics from the event log',
      'One results table with severities, and a blocked downstream task',
      'Lineage impact list and a metric view checked against the table',
    ],
  },
  {
    slug: 'sql-notebook-analysis',
    title: 'SQL and notebooks at scale',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Choose the right analysis surface and keep it fast at scale.',
    acceptanceCriteria:
      "Analysts explore in the SQL editor on a serverless SQL warehouse and use serverless notebooks for Python. They aggregate in Spark before collecting to pandas, use the pandas API on Spark for large data, and get help from Genie Code. R runs from the analyst's own IDE through sparklyr or ODBC, or in a classic-compute notebook, because serverless has no R and hosted RStudio is end-of-life.",
    evidence: [
      'SQL editor and notebook usage by job',
      'Aggregate-then-collect and pandas API on Spark',
      'A current R path',
    ],
  },
  {
    slug: 'bring-your-own-data',
    title: 'Bring your own data',
    category: 'Analyst Guides',
    difficulty: 1,
    summary: 'Let users upload files into a governed space and join them safely.',
    acceptanceCriteria:
      'Users upload files to a governed volume or sandbox schema, with grants on a group. They read files with read_files and an explicit schema and join to governed tables with a full outer join, so unmatched keys stay visible. Shared uploads are promoted to governed tables.',
    evidence: [
      'Upload options: Catalog Explorer, Lakeflow Designer, Excel Add-in',
      'Volume grants and retention for uploads',
      'Join with match status and a promotion path',
    ],
  },
  {
    slug: 'local-tool-connectivity',
    title: 'Connecting local tools',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Connect Excel, Power BI, Tableau, Python, R, and SAS to one SQL warehouse.',
    acceptanceCriteria:
      'Analysts reach Unity Catalog data from Excel (Add-in, GA), Power BI, Tableau, Python, R, SAS, and SPSS through a serverless SQL warehouse. Every client signs in with OAuth, with a service principal for unattended use and no personal access tokens in shared tools. Permissions follow the signed-in identity.',
    evidence: ['Client choice per tool', 'OAuth U2M and M2M sign-in', 'Warehouse sizing and network controls for BI'],
  },
  {
    slug: 'no-code-data-prep',
    title: 'No-code data preparation',
    category: 'Analyst Guides',
    difficulty: 1,
    summary: 'Prepare data visually with Lakeflow Designer, governed by Unity Catalog.',
    acceptanceCriteria:
      'A business user builds a visual data prep in Lakeflow Designer (GA) from governed sources, including metric views. Outputs go to a sandbox schema, the flow is stored in Git and promoted as a job or bundle, and complex or high-volume logic moves to SQL or a declarative pipeline.',
    evidence: [
      'Visual data prep built from governed sources',
      'Git, job, and bundle promotion path',
      'Guidance on when to hand off to code',
    ],
  },
  {
    slug: 'self-service-extracts',
    title: 'Self-service extracts and subscriptions',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Deliver reports and data to business users without custom extracts.',
    acceptanceCriteria:
      'Users subscribe to scheduled AI/BI dashboards, pull governed tables into Excel with the Excel Add-in, and ask Genie for ad hoc answers. Credential mode (shared or individual data permissions) is chosen on purpose. Files for partners come from a verified job into a volume, shared by grant or OpenSharing.',
    evidence: [
      'Dashboard schedule and subscription with attachments',
      'Excel Add-in and Genie as self-service paths',
      'Verified files delivered from a volume',
    ],
  },
  {
    slug: 'metric-views',
    title: 'Metric views',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Define a business metric once in YAML, query it everywhere, and deploy it as code.',
    acceptanceCriteria:
      'A business metric is defined once in a Unity Catalog metric view with joins, a filter, ratio and window measures, and synonyms. Dashboards, Genie, SQL, and BI tools query it with MEASURE(). The YAML is reviewed in source control and deployed with a bundle job, and each measure is checked against a hand-written aggregate.',
    evidence: [
      'Metric view YAML in source control with joins, measures, and synonyms',
      'MEASURE() queries that match hand-written SQL',
      'Deployment through a bundle job, promoted by catalog variable',
    ],
  },
  {
    slug: 'in-platform-visualization',
    title: 'Charts and dashboards in the platform',
    category: 'Analyst Guides',
    difficulty: 2,
    summary: 'Define metrics once and consume them in dashboards, notebooks, and Genie.',
    acceptanceCriteria:
      'Business metrics are defined once in Unity Catalog metric views. AI/BI dashboards, notebook charts, Genie, and BI tools consume them, so every surface shows the same number. Dashboards are deployed as code, and the datasets they use are certified.',
    evidence: [
      'Metric view with shared measures',
      'AI/BI dashboard on governed datasets',
      'Notebook charts and Genie on the same definitions',
    ],
  },
  {
    slug: 'access-management',
    title: 'Access management',
    category: 'Governance/Monitoring',
    difficulty: 2,
    summary: 'Grant access to groups, separate environments by catalog, and audit every permission change.',
    acceptanceCriteria:
      'Privileges go to account-level groups, never to individuals. Each environment has its own catalog bound to its workspace, ABAC with governed tags covers broad rules, groups or service principals own production objects, and permission changes are audited in system.access.audit.',
    evidence: [
      'Group-based grants and a check for direct grants',
      'Catalog-per-environment layout with workspace binding',
      'Ownership, MANAGE review, and permission audit query',
    ],
  },
  {
    slug: 'row-column-security',
    title: 'Row and column security',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary:
      'Protect rows and columns with ABAC policies on governed tags, and use per-table functions for targeted rules.',
    acceptanceCriteria:
      'One ABAC policy per governed tag masks columns or filters rows across every matching table. Per-table filter and mask functions cover one-off rules, sensitive columns are found by data classification, and the policies in force are listed from information_schema.',
    evidence: [
      'ABAC policies on governed tags',
      'Per-table row filter and column mask functions',
      'Policy inventory and limits review',
    ],
  },
  {
    slug: 'compute-capacity-management',
    title: 'Compute and capacity management',
    category: 'Governance/Monitoring',
    difficulty: 3,
    summary: 'Default to serverless, then size, isolate, tag, and monitor compute.',
    acceptanceCriteria:
      'Workloads run on serverless SQL warehouses, jobs, and notebooks by default. Warehouses are sized for the query and scaled out for concurrency, with one warehouse per workload. Queries carry tags, classic compute is limited by policies, auto-termination, and pools, and queueing is read from query history.',
    evidence: [
      'Serverless defaults and performance modes',
      'Warehouse sizing and isolation layout',
      'Query tags and a queueing query over query history',
    ],
  },
  {
    slug: 'cost-chargeback',
    title: 'Cost tracking and chargeback',
    category: 'Governance/Monitoring',
    difficulty: 2,
    summary:
      'Attribute spend with tags and serverless usage policies, alert with Budgets, and forecast once there is history.',
    acceptanceCriteria:
      'Classic compute carries enforced custom tags and serverless usage carries a serverless usage policy, so spend rolls up by team. Budgets alert on thresholds, usage_metadata and identity_metadata fill the gaps, and untagged spend is tracked down to zero.',
    evidence: [
      'Tag and serverless usage policy coverage for classic and serverless spend',
      'Budget thresholds and account usage dashboards',
      'Untagged-spend and product-level usage queries',
    ],
  },
];

export function getGuide(slug: string | undefined) {
  return guides.find((guide) => guide.slug === slug);
}
