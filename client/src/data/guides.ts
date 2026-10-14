export const categories = [
  'CI/CD & Version Control Demo',
  'Governance/Monitoring',
  'AI Demos',
  'ML Demos',
  'General Demos',
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
    title: 'Configuration vs code',
    category: 'General Demos',
    summary: 'Separate provider-specific adapters from reusable control-plane services.',
    acceptanceCriteria:
      'Show that provider-specific logic is isolated while audit, validation, orchestration, and error handling are reused.',
    evidence: [
      'Provider adapter and shared framework boundary',
      'Common validation, audit, and exception flow',
      'Run trace proving shared orchestration behavior',
    ],
  },
  {
    slug: 'reusability-templatization',
    title: 'Reusability / templatization',
    category: 'General Demos',
    summary: 'Prove that a second source can be onboarded without rebuilding the framework.',
    acceptanceCriteria:
      'Onboard a second representative feed through configuration and mappings without redesigning the core framework.',
    evidence: [
      'Two representative source configurations',
      'Mapping-only onboarding diff',
      'Comparable successful runs for both feeds',
    ],
  },
  {
    slug: 'batch-real-time-ingestion',
    title: 'Batch and real-time ingestion',
    category: 'General Demos',
    summary: 'Demonstrate priority batch and supported streaming ingestion patterns.',
    acceptanceCriteria:
      'Implement the priority batch pattern and demonstrate the supported real-time path, including latency, scaling, and monitoring evidence.',
    evidence: [
      'Batch and streaming reference pipelines',
      'Latency and throughput measurements',
      'Scaling, checkpoint, and monitoring evidence',
    ],
  },
  {
    slug: 'ide-developer-experience',
    title: 'IDE and developer experience',
    category: 'CI/CD & Version Control Demo',
    summary: 'Capture a representative author, debug, and test workflow.',
    acceptanceCriteria:
      'Complete a representative author-debug-test workflow using supported SQL, Python, notebook, or pipeline tooling.',
    evidence: [
      'Local and workspace development workflow',
      'Debug and test transcript',
      'Developer setup and dependency notes',
    ],
  },
  {
    slug: 'github-cicd',
    title: 'GitHub integration and CI/CD',
    category: 'CI/CD & Version Control Demo',
    summary: 'Promote one traceable release across development and test.',
    acceptanceCriteria:
      'Version artifacts in GitHub and deploy the same release through development and test using automation and approval.',
    evidence: [
      'GitHub source and release reference',
      'Development and test deployment runs',
      'Approval and immutable release evidence',
    ],
  },
  {
    slug: 'versioning',
    title: 'Versioning',
    category: 'CI/CD & Version Control Demo',
    summary: 'Show compatible evolution and governed breaking-change handling.',
    acceptanceCriteria:
      'Demonstrate nonbreaking and breaking changes, traceability, consumer notification, compatibility, and deprecation handling.',
    evidence: [
      'Compatible and breaking change examples',
      'Consumer impact and notification record',
      'Deprecation timeline and traceability',
    ],
  },
  {
    slug: 'model-deployment-cicd',
    title: 'Model deployment and CI/CD',
    category: 'ML Demos',
    summary: 'Release an approved model through an auditable automated path.',
    acceptanceCriteria:
      'Deploy an approved model version through CI/CD with automated tests, approval, environment-specific configuration, and auditable release history.',
    evidence: [
      'Model approval and automated quality gates',
      'Environment-specific deployment configuration',
      'Serving release and audit history',
    ],
  },
  {
    slug: 'dataops',
    title: 'DataOps',
    category: 'CI/CD & Version Control Demo',
    summary: 'Exercise day-two controls across isolated environments.',
    acceptanceCriteria:
      'Demonstrate environment separation, run history, alerting, retry/restart, audit trail, and rollback or redeployment.',
    evidence: [
      'Development and test environment boundaries',
      'Failure, alert, and recovery run',
      'Rollback or redeployment evidence',
    ],
  },
  {
    slug: 'documentation-generation',
    title: 'Documentation generation',
    category: 'Governance/Monitoring',
    summary: 'Generate governed technical and usage documentation from platform metadata.',
    acceptanceCriteria:
      'Generate and refresh documentation containing schema, lineage, quality, ownership, and usage guidance.',
    evidence: [
      'Generated schema and ownership documentation',
      'Lineage and quality metadata',
      'Refresh workflow and usage guidance',
    ],
  },
  {
    slug: 'monitoring',
    title: 'Monitoring',
    category: 'Governance/Monitoring',
    summary: 'Unify operational, usage, cost, and audit signals.',
    acceptanceCriteria:
      'Provide a consolidated view of runs, failures, usage, compute/capacity, audit events, and alert routing.',
    evidence: [
      'Consolidated monitoring view',
      'Failure-to-owner alert route',
      'Compute, capacity, usage, and audit evidence',
    ],
  },
  {
    slug: 'user-experience',
    title: 'User experience',
    category: 'AI Demos',
    summary: 'Observe representative users completing core discovery tasks.',
    acceptanceCriteria:
      'Representative users complete discovery, question, refinement, and feedback tasks; issues and training needs are recorded.',
    evidence: [
      'Representative user task script',
      'Observed outcomes and feedback',
      'Issue and training-needs register',
    ],
  },
  {
    slug: 'ontology',
    title: 'Ontology',
    category: 'AI Demos',
    summary: 'Improve discovery through governed concepts and synonyms.',
    acceptanceCriteria:
      'Represent priority concepts and synonyms and show improved discovery or question interpretation.',
    evidence: [
      'Priority concept and synonym model',
      'Before-and-after discovery examples',
      'Interpretation quality evidence',
    ],
  },
  {
    slug: 'agent-framework-support',
    title: 'Agent framework support',
    category: 'AI Demos',
    summary: 'Evaluate governed MCP, A2A, and model-gateway operations end to end.',
    acceptanceCriteria:
      'Demonstrate one governed MCP tool call and one cross-agent handoff; route the same prompt to at least two approved frontier models through a gateway; enforce identity, least privilege, rate/token limits, content-safety policy, audit/trace capture, cost attribution, and model fallback. Document GA versus preview status, supported regions, protocol versions, latency, and portability.',
    evidence: [
      'Governed MCP call and cross-agent trace',
      'Two-model gateway comparison and fallback',
      'Controls, cost, latency, and portability matrix',
    ],
  },
  {
    slug: 'agent-build-deployment',
    title: 'Ease of agent build and deployment',
    category: 'AI Demos',
    summary: 'Document the full assistant build-to-operations lifecycle.',
    acceptanceCriteria:
      'Build, deploy, version, secure, and monitor the assistant; document custom code, dependencies, and operational ownership.',
    evidence: [
      'Versioned assistant implementation',
      'Security and deployment configuration',
      'Monitoring and operational ownership record',
    ],
  },
  {
    slug: 'data-ingestion-feature-preparation',
    title: 'Data ingestion and feature preparation',
    category: 'ML Demos',
    summary: 'Create reproducible, governed model inputs from source data.',
    acceptanceCriteria:
      'Ingest representative data, create reproducible features, validate quality, and persist versioned model inputs with lineage to source.',
    evidence: [
      'Source-to-feature pipeline',
      'Quality checks and versioned model input',
      'Feature lineage and reproducibility run',
    ],
  },
  {
    slug: 'model-training-compatibility',
    title: 'Model training and compatibility',
    category: 'ML Demos',
    summary: 'Reproduce baseline model behavior in the target runtime.',
    acceptanceCriteria:
      'Train or load the selected model successfully, reproduce agreed baseline behavior, and document code, library, runtime, and portability changes.',
    evidence: [
      'Training or model-load run',
      'Baseline comparison within tolerance',
      'Runtime, library, and portability change log',
    ],
  },
  {
    slug: 'experiment-tracking',
    title: 'Experiment tracking and reproducibility',
    category: 'ML Demos',
    summary: 'Replay a recorded experiment from tracked inputs.',
    acceptanceCriteria:
      'Rerun a recorded experiment using tracked data/code/environment references and reproduce results within an agreed tolerance.',
    evidence: [
      'Tracked experiment and environment references',
      'Reproduction run',
      'Tolerance comparison and variance notes',
    ],
  },
  {
    slug: 'real-time-scoring',
    title: 'Real-time or on-demand scoring',
    category: 'ML Demos',
    summary: 'Measure a secured online inference path under normal and failure conditions.',
    acceptanceCriteria:
      'Demonstrate a secured scoring request, response, latency measurement, scaling approach, and failure behavior using the selected model.',
    evidence: [
      'Authenticated request and response',
      'Latency and scaling measurements',
      'Failure-mode behavior and recovery',
    ],
  },
  {
    slug: 'model-performance-drift',
    title: 'Model performance and drift monitoring',
    category: 'ML Demos',
    summary: 'Detect a simulated breach and route action to the owner.',
    acceptanceCriteria:
      'Display operational and model metrics, simulate one drift or threshold breach, alert the owner, and document the retraining or review workflow.',
    evidence: [
      'Operational and model metric view',
      'Simulated breach and owner alert',
      'Review or retraining workflow',
    ],
  },
  {
    slug: 'operational-support',
    title: 'Operational support',
    category: 'Governance/Monitoring',
    summary: 'Exercise support ownership and a representative recovery path.',
    acceptanceCriteria: 'Demonstrate triage, restart/recovery, resiliency approach, support escalation, and ownership.',
    evidence: ['Triage and recovery exercise', 'Resiliency approach', 'Escalation path and ownership matrix'],
  },
  {
    slug: 'iceberg-support',
    title: 'Iceberg support',
    category: 'General Demos',
    summary: 'Validate governed Iceberg interoperability and table evolution.',
    acceptanceCriteria:
      'Read and write a representative table and demonstrate catalog integration, evolution, time travel, and external access where supported.',
    evidence: [
      'Representative read and write run',
      'Evolution and time-travel evidence',
      'Catalog and external access validation',
    ],
  },
  {
    slug: 'external-integrations',
    title: 'External tool integrations',
    category: 'General Demos',
    summary: 'Connect two priority tools through supported integration patterns.',
    acceptanceCriteria: 'Demonstrate at least two priority integrations using supported patterns.',
    evidence: [
      'Two configured integrations',
      'Identity and connectivity pattern',
      'Successful end-to-end exchange runs',
    ],
  },
  {
    slug: 'legacy-conversion',
    title: 'Legacy conversion',
    category: 'General Demos',
    summary: 'Assess conversion coverage and the remaining human effort.',
    acceptanceCriteria:
      'Assess one representative workload and record automated coverage, remediation, testing, and role-based effort.',
    evidence: [
      'Representative workload assessment',
      'Automated coverage and remediation log',
      'Test results and role-based effort estimate',
    ],
  },
  {
    slug: 'data-sharing',
    title: 'Data sharing',
    category: 'Governance/Monitoring',
    summary: 'Exercise governed sharing, entitlement, and revocation.',
    acceptanceCriteria:
      'Share a governed dataset, demonstrate entitlement and revocation, and document whether replication is required.',
    evidence: [
      'Governed share and recipient setup',
      'Entitlement and revocation run',
      'Replication requirement decision',
    ],
  },
  {
    slug: 'platform-administration',
    title: 'Platform administration',
    category: 'Governance/Monitoring',
    summary: 'Walk through the core enterprise administration operating model.',
    acceptanceCriteria:
      'Demonstrate workspace/account setup, role administration, policy configuration, capacity management, audit access, and routine support tasks.',
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
