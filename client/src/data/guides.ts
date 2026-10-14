export const categories = [
  'CI/CD & Version Control Guides',
  'Governance/Monitoring',
  'AI Guides',
  'ML Guides',
  'Ingestion',
  'General Guides',
] as const;

export type GuideCategory = (typeof categories)[number];

export type Guide = {
  slug: string;
  title: string;
  category: GuideCategory;
  summary: string;
  acceptanceCriteria: string;
  evidence: readonly string[];
  codeUrl?: string;
  runUrl?: string;
};

export const guides: readonly Guide[] = [
  {
    slug: 'configuration-vs-code',
    title: 'Configuration-driven ingestion',
    category: 'Ingestion',
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
    slug: 'github-cicd',
    title: 'GitHub-based CI/CD',
    category: 'CI/CD & Version Control Guides',
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
    slug: 'user-experience',
    title: 'Assistant user experience',
    category: 'AI Guides',
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
    summary: 'Exercise support ownership and a representative recovery path.',
    acceptanceCriteria: 'Triage an incident, restart or recover the workload, and follow the escalation path and ownership.',
    evidence: ['Triage and recovery exercise', 'Resiliency approach', 'Escalation path and ownership matrix'],
  },
  {
    slug: 'iceberg-support',
    title: 'Apache Iceberg interoperability',
    category: 'General Guides',
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
    slug: 'external-integrations',
    title: 'Partner tool integrations',
    category: 'General Guides',
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
    summary: 'Walk through the core enterprise administration operating model.',
    acceptanceCriteria:
      'Set up workspaces and roles, apply policies, manage capacity, read audit logs, and handle routine support.',
    evidence: [
      'Workspace and account setup record',
      'Roles, policies, and capacity controls',
      'Audit access and routine support procedure',
    ],
  },
];

export function getGuide(slug: string | undefined) {
  return guides.find((guide) => guide.slug === slug);
}
