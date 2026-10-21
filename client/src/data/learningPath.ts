// The order to learn the guides in. Each stage builds on the ones before it: the platform model first,
// then setting up and using it, then building, governing, and extending it with ML and agents.
export type LearningStage = { title: string; summary: string; slugs: readonly string[] };

export const learningPath: readonly LearningStage[] = [
  {
    title: 'Foundations',
    summary: 'How storage, compute, and Unity Catalog fit together, and how data moves through layers.',
    slugs: ['how-databricks-works', 'unity-catalog-basics', 'medallion-architecture'],
  },
  {
    title: 'Set up the platform',
    summary: 'Environments, access, administration, compute, and cost, decided before teams start building.',
    slugs: [
      'environment-workspaces-catalogs',
      'access-management',
      'platform-administration',
      'compute-capacity-management',
      'cost-chargeback',
    ],
  },
  {
    title: 'Explore and share data',
    summary: 'Query, upload, prepare, chart, and deliver governed data, with or without code.',
    slugs: [
      'sql-notebook-analysis',
      'bring-your-own-data',
      'no-code-data-prep',
      'in-platform-visualization',
      'local-tool-connectivity',
      'self-service-extracts',
    ],
  },
  {
    title: 'Set up your developer workflow',
    summary: 'Work in the IDE, collaborate in Git, and ship with bundles and CI/CD.',
    slugs: ['vscode-databricks', 'git-collaboration', 'dab-starter', 'ide-developer-experience', 'github-cicd'],
  },
  {
    title: 'Ingest data',
    summary: 'Bring in files, databases, APIs, and streams, then make onboarding repeatable.',
    slugs: [
      'file-format-ingestion',
      'relational-db-ingestion',
      'rest-api-ingestion',
      'sftp-ingestion',
      'sqlserver-lakeflow-connect',
      'batch-real-time-ingestion',
      'multi-source-pipeline',
      'configuration-vs-code',
      'reusability-templatization',
    ],
  },
  {
    title: 'Engineer pipelines',
    summary: 'Transform, load, capture change, orchestrate, operate, and version what you build.',
    slugs: [
      'transformation-patterns',
      'target-loading-outputs',
      'scd-change-capture',
      'cdc-incremental-refresh',
      'orchestration-patterns',
      'data-validation-framework',
      'dataops',
      'versioning',
    ],
  },
  {
    title: 'Govern and operate',
    summary: 'Protect sensitive data, document and observe it, support it, and share it safely.',
    slugs: [
      'row-column-security',
      'documentation-generation',
      'data-observability',
      'monitoring',
      'operational-support',
      'data-sharing',
    ],
  },
  {
    title: 'Open formats and integrations',
    summary: 'Delta and Iceberg, other engines and tools, and migrating legacy workloads.',
    slugs: ['file-formats-delta-iceberg', 'iceberg-support', 'external-integrations', 'legacy-conversion'],
  },
  {
    title: 'AI on your data',
    summary: 'AI Functions in SQL, then Genie Agents and the semantics that make their answers right.',
    slugs: ['ai-functions', 'genie-agents', 'ontology', 'user-experience'],
  },
  {
    title: 'Machine learning',
    summary: 'Features, experiments, training, release, serving, and drift.',
    slugs: [
      'data-ingestion-feature-preparation',
      'experiment-tracking',
      'model-training-compatibility',
      'model-deployment-cicd',
      'real-time-scoring',
      'model-performance-drift',
    ],
  },
  {
    title: 'Agents',
    summary: 'Govern agent tools and models, build and ship agents, and run coding agents as a team.',
    slugs: ['agent-framework-support', 'agent-build-deployment', 'omnigent'],
  },
];

/** 1-based step number of each guide along the path. */
export const learningStep: ReadonlyMap<string, number> = new Map(
  learningPath.flatMap((stage) => stage.slugs).map((slug, index) => [slug, index + 1]),
);
