export type EvidenceState = 'Ready' | 'Located' | 'Partial' | 'Pending';

export type SrpCapability = {
  name: string;
  responsibility: string;
};

export type SrpReference = {
  path: string;
  finding: string;
  state: Exclude<EvidenceState, 'Ready' | 'Pending'>;
};

export type SrpDemo = {
  slug: string;
  title: string;
  mappedGuide: string;
  mappedGuideSlug: string;
  summary: string;
  mustProve: string;
  specState: EvidenceState;
  codeState: EvidenceState;
  runState: EvidenceState;
  providerSpecific: readonly string[];
  sharedFramework: readonly string[];
  capabilities: readonly SrpCapability[];
  sequence: readonly string[];
  acceptance: readonly string[];
  plannedArtifacts: readonly string[];
  references: readonly SrpReference[];
};

export const srpDemos: readonly SrpDemo[] = [
  {
    slug: 'configuration-vs-code',
    title: 'Configuration vs code',
    mappedGuide: 'Configuration vs code',
    mappedGuideSlug: 'configuration-vs-code',
    summary: 'Isolate source adapters and mappings while reusing the complete operational control plane.',
    mustProve:
      'Show that provider-specific logic is isolated while audit, validation, orchestration, and error handling are reused.',
    specState: 'Ready',
    codeState: 'Partial',
    runState: 'Pending',
    providerSpecific: [
      'Source connection and file format',
      'Source schema and column mappings',
      'Provider normalization adapter',
    ],
    sharedFramework: [
      'Configuration validation',
      'Audit columns and correlation IDs',
      'Quarantine routing',
      'Exception normalization',
      'Pipeline orchestration',
    ],
    capabilities: [
      {
        name: 'Databricks Asset Bundles',
        responsibility: 'Inject environment and feed parameters through targets and variables.',
      },
      {
        name: 'Lakeflow Spark Declarative Pipelines',
        responsibility: 'Run the same medallion framework for every configured provider.',
      },
      { name: 'Unity Catalog', responsibility: 'Govern tables, lineage, ownership, and shared contracts.' },
      { name: 'Pipeline event log', responsibility: 'Capture update, flow, and expectation telemetry.' },
    ],
    sequence: [
      'Load the provider A feed manifest and validate required configuration.',
      'Invoke only the provider A adapter for source reading and field normalization.',
      'Pass normalized data through shared audit, validation, quarantine, and medallion modules.',
      'Repeat with the second feed and compare the shared-framework Git diff.',
      'Link both successful pipeline updates and the immutable release SHA.',
    ],
    acceptance: [
      'Provider-specific code is limited to adapter, schema, and mapping artifacts.',
      'Shared audit, validation, orchestration, and error modules are unchanged for feed two.',
      'Both feeds produce the same operational metadata and evidence contract.',
    ],
    plannedArtifacts: [
      'src/srp/providers/base.py',
      'src/srp/providers/files.py',
      'src/srp/shared/{validation,audit,quarantine,errors}.py',
      'config/feeds/{provider-a,provider-b}.yml',
    ],
    references: [
      {
        path: 'examples/srp/config/feeds/provider-a.yml',
        finding:
          'Public-safe feed definition keeps source shape, mappings, quality rules, and ownership outside the shared framework.',
        state: 'Partial',
      },
      {
        path: 'examples/srp/architecture.md',
        finding:
          'Reference boundary defines thin provider adapters and reusable validation, audit, quarantine, orchestration, and error handling.',
        state: 'Located',
      },
    ],
  },
  {
    slug: 'feed-onboarding',
    title: 'Configuration-only feed onboarding',
    mappedGuide: 'Reusability / templatization',
    mappedGuideSlug: 'reusability-templatization',
    summary: 'Add a second representative feed through manifests and mappings without redesigning the framework.',
    mustProve:
      'Onboard a second representative feed through configuration and mappings without redesigning the core framework.',
    specState: 'Ready',
    codeState: 'Located',
    runState: 'Pending',
    providerSpecific: ['Provider B feed manifest', 'Provider B canonical mapping', 'Source fixture and contract test'],
    sharedFramework: [
      'Manifest loader',
      'Pipeline factory',
      'Canonical domain model',
      'Quality rule engine',
      'Evidence recorder',
    ],
    capabilities: [
      {
        name: 'Pipeline configuration',
        responsibility: 'Expose source, mapping, target, quality, and ownership parameters.',
      },
      {
        name: 'Unity Catalog Volumes',
        responsibility: 'Stage versioned source files and generated events with provenance.',
      },
      {
        name: 'Lakeflow Jobs',
        responsibility: 'Instantiate the same validation and pipeline task graph for each feed.',
      },
      {
        name: 'DAB targets',
        responsibility: 'Promote identical configuration contracts through development and test.',
      },
    ],
    sequence: [
      'Run provider A as the baseline using the shared pipeline factory.',
      'Add the provider B manifest, canonical mapping, and source fixture.',
      'Deploy a second pipeline resource instance without changing shared modules.',
      'Compare output contracts, audit fields, quarantine schema, and run traces.',
    ],
    acceptance: [
      'Second-feed onboarding changes only configuration, mappings, fixtures, and resource instantiation.',
      'The shared framework diff is zero.',
      'Both feeds pass the same contract and operational evidence checks.',
    ],
    plannedArtifacts: [
      'config/feeds/provider-b.yml',
      'config/mappings/provider-b.yml',
      'tests/fixtures/provider-b/',
      'resources/srp.pipelines.yml',
    ],
    references: [
      {
        path: 'examples/srp/config/feeds/provider-a.yml',
        finding: 'Provider A defines a representative batch feed with canonical mappings and quality rules.',
        state: 'Located',
      },
      {
        path: 'examples/srp/config/feeds/provider-b.yml',
        finding: 'Provider B demonstrates a second feed added through configuration and mappings only.',
        state: 'Located',
      },
    ],
  },
  {
    slug: 'medallion-data-generation',
    title: 'Medallion data generation',
    mappedGuide: 'Data ingestion and feature preparation',
    mappedGuideSlug: 'data-ingestion-feature-preparation',
    summary: 'Combine public reference data with deterministic synthetic operational feeds.',
    mustProve:
      'Create a reproducible data foundation spanning representative reference sources, synthetic operational events, and governed Bronze, Silver, and Gold products.',
    specState: 'Ready',
    codeState: 'Located',
    runState: 'Pending',
    providerSpecific: ['Reference archive selection', 'Batch record shape', 'Incremental event shape'],
    sharedFramework: [
      'Deterministic generator seed',
      'Bronze registration factory',
      'Canonical dimensions and facts',
      'Gold metric definitions',
      'Provenance capture',
    ],
    capabilities: [
      {
        name: 'Spark + dbldatagen/Faker',
        responsibility: 'Generate deterministic entities, transactions, relationships, and operational events.',
      },
      {
        name: 'Auto Loader',
        responsibility: 'Incrementally ingest staged CSV and JSON files into Bronze streaming tables.',
      },
      { name: 'Materialized views', responsibility: 'Publish Silver conformance and Gold domain outcomes.' },
      { name: 'Unity Catalog lineage', responsibility: 'Trace sources through medallion products.' },
    ],
    sequence: [
      'Stage a representative public or synthetic reference archive with checksums.',
      'Generate source-shaped batch records and incremental events with a fixed seed.',
      'Write representative CSV, JSON, XML, and malformed variants to a governed Volume.',
      'Build Bronze, canonical Silver, and outcome-focused Gold products.',
      'Capture source manifest, seed, Git SHA, and table lineage as evidence.',
    ],
    acceptance: [
      'The same seed and source manifest reproduce the same input population.',
      'Every Gold result has lineage to governed Bronze data.',
      'Generated data includes valid, duplicate, malformed, missing-key, and schema-evolution cases.',
    ],
    plannedArtifacts: [
      'src/srp/generator/',
      'config/sources/provider-a.json',
      'resources/srp.pipeline.yml',
      'tests/integration/test_medallion_outputs.py',
    ],
    references: [
      {
        path: 'examples/srp/data-foundation.md',
        finding:
          'Documents representative inputs, deterministic synthetic operational feeds, medallion outputs, and provenance requirements.',
        state: 'Located',
      },
      {
        path: 'examples/srp/config/feeds/provider-a.yml',
        finding:
          'Defines the public reference source, archive cadence, schema contract, and target products without workspace-specific values.',
        state: 'Located',
      },
    ],
  },
  {
    slug: 'batch-and-real-time',
    title: 'Batch and real-time ingestion path',
    mappedGuide: 'Batch and real-time ingestion',
    mappedGuideSlug: 'batch-real-time-ingestion',
    summary: 'Demonstrate priority batch first, then measure the supported incremental path.',
    mustProve:
      'Implement the priority batch pattern and demonstrate the supported real-time path, including latency, scaling, and monitoring evidence.',
    specState: 'Ready',
    codeState: 'Partial',
    runState: 'Pending',
    providerSpecific: ['Batch archive cadence', 'Event source connector', 'Source watermark and replay boundary'],
    sharedFramework: [
      'Checkpoint policy',
      'Backlog and latency metrics',
      'Schema rescue',
      'Idempotency and deduplication',
      'Scaling configuration',
    ],
    capabilities: [
      {
        name: 'Triggered Lakeflow pipeline',
        responsibility: 'Run priority batch ingestion using available-now semantics.',
      },
      { name: 'Streaming tables', responsibility: 'Process incremental files or events with managed checkpoints.' },
      { name: 'Auto Loader', responsibility: 'Track new files, rescued data, and schema evolution.' },
      { name: 'Pipeline event log', responsibility: 'Measure input rows, backlog, duration, and flow progress.' },
    ],
    sequence: [
      'Load a representative snapshot through the triggered batch path.',
      'Start the incremental provider event path from a recorded checkpoint.',
      'Measure source-to-Bronze and Bronze-to-Gold latency under two load levels.',
      'Restart from checkpoint and verify no loss or duplication.',
      'Record throughput, backlog, scaling configuration, and cost attribution.',
    ],
    acceptance: [
      'Batch completion, volume, and SLA are captured from an actual update.',
      'Incremental latency is measured rather than described as real-time by assumption.',
      'Replay and scale tests preserve correctness and observable checkpoints.',
    ],
    plannedArtifacts: [
      'src/srp/pipelines/batch.py',
      'src/srp/pipelines/streaming.py',
      'config/feeds/*.yml',
      'src/srp/ops/latency_metrics.sql',
    ],
    references: [
      {
        path: 'examples/srp/architecture.md',
        finding: 'Specifies triggered batch and incremental paths, latency checkpoints, replay, and scale evidence.',
        state: 'Located',
      },
      {
        path: 'examples/srp/config/feeds/provider-b.yml',
        finding: 'Provides an incremental second-feed contract without prescribing a private connector or environment.',
        state: 'Partial',
      },
    ],
  },
  {
    slug: 'quality-and-quarantine',
    title: 'Quality, quarantine, and replay',
    mappedGuide: 'DataOps',
    mappedGuideSlug: 'dataops',
    summary: 'Preserve invalid records with reasons, metrics, and a governed replay path.',
    mustProve:
      'Demonstrate reusable quality rules, visible invalid-row preservation, alerting on quarantine growth, and successful correction and replay.',
    specState: 'Ready',
    codeState: 'Partial',
    runState: 'Pending',
    providerSpecific: ['Feed quality thresholds', 'Source schema rules', 'Provider correction mapping'],
    sharedFramework: [
      'Expectation registry',
      'Rescued-data routing',
      'Value-rule quarantine',
      'Disposition and replay workflow',
      'Quality event capture',
    ],
    capabilities: [
      { name: 'Lakeflow expectations', responsibility: 'Track warn, drop, and fail rules in the UI and event log.' },
      { name: 'Rescued data column', responsibility: 'Preserve schema and parse failures from Auto Loader.' },
      {
        name: 'Quarantine streaming table',
        responsibility: 'Retain raw payload, rule, source metadata, and disposition.',
      },
      { name: 'Databricks SQL alert', responsibility: 'Route abnormal quarantine rate or volume to the owner.' },
    ],
    sequence: [
      'Generate malformed, duplicate, missing-key, and schema-evolution records.',
      'Route parse/schema failures to Bronze quarantine using rescued data.',
      'Split valid and invalid value-rule records from a shared normalized view.',
      'Correct a quarantined record and replay it through the same pipeline contract.',
      'Link expectation metrics, quarantine rows, the alert event, and replay result.',
    ],
    acceptance: [
      'No invalid record is silently discarded.',
      'Quarantine stores raw payload, failed rules, feed, source file, update ID, timestamps, and disposition.',
      'A corrected record is replayed exactly once and linked to its original failure.',
    ],
    plannedArtifacts: [
      'src/srp/shared/quality.py',
      'src/srp/shared/quarantine.py',
      'src/srp/pipelines/quarantine.py',
      'resources/srp.alerts.yml',
    ],
    references: [
      {
        path: 'examples/srp/quality-and-quarantine.md',
        finding:
          'Distinguishes expectation drops from real quarantine and defines invalid-row preservation and replay.',
        state: 'Partial',
      },
      {
        path: 'examples/srp/architecture.md',
        finding: 'Places schema rescue, value-rule quarantine, correction, and replay inside the shared framework.',
        state: 'Located',
      },
    ],
  },
  {
    slug: 'orchestration-and-recovery',
    title: 'Scheduled orchestration and recovery',
    mappedGuide: 'DataOps',
    mappedGuideSlug: 'dataops',
    summary: 'Exercise scheduling, retries, failure capture, restart, repair, and notification.',
    mustProve:
      'Demonstrate scheduled orchestration, task dependencies, controlled retries, alert routing, restart or repair, and an auditable recovery outcome.',
    specState: 'Ready',
    codeState: 'Partial',
    runState: 'Pending',
    providerSpecific: ['Feed schedule or file trigger', 'Source precheck', 'Feed-specific SLA threshold'],
    sharedFramework: [
      'Task DAG',
      'Retry and timeout policy',
      'Failure evidence capture',
      'ALL_DONE notification',
      'Repair and restart runbook',
    ],
    capabilities: [
      {
        name: 'Lakeflow Jobs',
        responsibility: 'Orchestrate generation, precheck, pipeline, validation, evidence, and notification tasks.',
      },
      {
        name: 'Task retry policy',
        responsibility: 'Configure maximum retries, retry interval, timeout, and retry-on-timeout.',
      },
      {
        name: 'Run conditions',
        responsibility: 'Capture failure evidence with AT_LEAST_ONE_FAILED and notify with ALL_DONE.',
      },
      { name: 'Health rules', responsibility: 'Alert on duration, failure, and SLA breaches.' },
    ],
    sequence: [
      'Trigger the job through its production-representative schedule or event.',
      'Inject a controlled transient failure in development attempt one.',
      'Observe configured retry and successful downstream validation.',
      'Exercise repair or restart for a persistent failure case.',
      'Capture notifications, task attempts, terminal states, and operator actions.',
    ],
    acceptance: [
      'The job graph is scheduled and queue/concurrency behavior is documented.',
      'A controlled transient failure produces a visible retry attempt and successful completion.',
      'Failure evidence and owner notification are produced even when the main pipeline fails.',
    ],
    plannedArtifacts: [
      'resources/srp.jobs.yml',
      'src/srp/ops/precheck.py',
      'src/srp/ops/capture_evidence.py',
      'docs/srp/recovery-runbook.md',
    ],
    references: [
      {
        path: 'examples/srp/resources/orchestration.job.yml',
        finding:
          'Public template specifies the task graph, schedule, retry policy, failure capture, and terminal notification.',
        state: 'Located',
      },
      {
        path: 'examples/srp/recovery-runbook.md',
        finding: 'Defines controlled failure injection, repair, restart, evidence capture, and owner escalation.',
        state: 'Partial',
      },
    ],
  },
  {
    slug: 'audit-and-monitoring',
    title: 'Audit and operational monitoring',
    mappedGuide: 'Monitoring',
    mappedGuideSlug: 'monitoring',
    summary: 'Correlate platform audit, lineage, runtime, quality, and cost evidence.',
    mustProve:
      'Provide a consolidated view of pipeline updates, quality outcomes, scheduled runs, retries, audit events, lineage, usage, and alert routing.',
    specState: 'Ready',
    codeState: 'Located',
    runState: 'Pending',
    providerSpecific: ['Feed owner and SLA', 'Feed-level cost tag', 'Quality threshold'],
    sharedFramework: [
      'Run correlation model',
      'System-table queries',
      'Pipeline event-log metrics',
      'Evidence ledger',
      'Alert routing',
    ],
    capabilities: [
      { name: 'system.lakeflow.job_run_timeline', responsibility: 'Audit scheduled run state, timing, and duration.' },
      {
        name: 'system.lakeflow.job_task_run_timeline',
        responsibility: 'Inspect task attempts, retries, and failures.',
      },
      { name: 'system.access.audit', responsibility: 'Trace deploy, run, permission, and governance activity.' },
      { name: 'system.access.table_lineage', responsibility: 'Prove Bronze-to-Silver-to-Gold data movement.' },
      { name: 'system.billing.usage', responsibility: 'Attribute capacity and cost using workspace and custom tags.' },
    ],
    sequence: [
      'Write the release SHA, bundle target, job ID, pipeline ID, and run correlation key to the evidence ledger.',
      'Query native pipeline event logs for flow and expectation outcomes.',
      'Query Lakeflow timelines for schedules, retries, duration, and terminal state.',
      'Correlate audit, lineage, and usage records within bounded time windows.',
      'Publish the consolidated evidence view and route one threshold alert.',
    ],
    acceptance: [
      'A single correlation model joins release, environment, job run, pipeline update, and generated tables.',
      'All system-table queries include bounded date filters and least-privilege access.',
      'The app links to real platform evidence rather than screenshots alone.',
    ],
    plannedArtifacts: [
      'src/srp/ops/system_tables.sql',
      'src/srp/ops/pipeline_event_log.sql',
      'src/srp/ops/evidence_ledger.py',
      'resources/srp.alerts.yml',
    ],
    references: [
      {
        path: 'examples/srp/sql/system-table-evidence.sql',
        finding:
          'Public query examples cover Lakeflow run timelines, audit, lineage, and usage with bounded date filters.',
        state: 'Located',
      },
      {
        path: 'examples/srp/evidence-contract.md',
        finding:
          'Defines the portable evidence ledger that correlates release, environment, jobs, pipeline updates, and outputs.',
        state: 'Partial',
      },
    ],
  },
  {
    slug: 'cicd-and-environments',
    title: 'CI/CD and environment promotion',
    mappedGuide: 'GitHub integration and CI/CD',
    mappedGuideSlug: 'github-cicd',
    summary: 'Promote the same immutable SRP release through development and test with approval.',
    mustProve:
      'Version the complete reference pattern in GitHub and deploy the same release through development and test using automation, approval, environment-specific configuration, and auditable rollback.',
    specState: 'Ready',
    codeState: 'Partial',
    runState: 'Pending',
    providerSpecific: ['Environment source paths', 'Feed enablement', 'Owner notification destination'],
    sharedFramework: [
      'Bundle validation',
      'Release SHA capture',
      'Deployment workflow',
      'Approval gate',
      'Rollback or redeployment procedure',
    ],
    capabilities: [
      {
        name: 'Databricks Asset Bundles',
        responsibility: 'Define pipelines, jobs, alerts, variables, and development/test targets.',
      },
      { name: 'GitHub Actions', responsibility: 'Validate, test, deploy, and preserve release history.' },
      {
        name: 'Workspace identity',
        responsibility: 'Use environment-specific service principals and least privilege.',
      },
      {
        name: 'Bundle deployment metadata',
        responsibility: 'Correlate the immutable SHA with deployed resources and runs.',
      },
    ],
    sequence: [
      'Validate formatting, unit tests, pipeline syntax, and bundle configuration on pull request.',
      'Deploy the release SHA to development and execute the evidence job.',
      'Require approval using the development result and evidence ledger.',
      'Deploy the identical SHA to test with test-specific variables only.',
      'Exercise rollback or redeployment and record the release history.',
    ],
    acceptance: [
      'Development and test run the same immutable Git SHA.',
      'Only target variables, identities, and governed resource bindings differ by environment.',
      'Approval, deployment, evidence run, and rollback are traceable in GitHub and Databricks.',
    ],
    plannedArtifacts: [
      'databricks.yml',
      'resources/{srp.pipelines,srp.jobs,srp.alerts}.yml',
      '.github/workflows/srp-release.yml',
      'docs/srp/release-runbook.md',
    ],
    references: [
      {
        path: 'examples/srp/cicd-and-environments.md',
        finding:
          'Documents portable development and test promotion, approval, immutable releases, and rollback evidence.',
        state: 'Partial',
      },
      {
        path: 'examples/srp/resources/orchestration.job.yml',
        finding:
          'Uses variable placeholders and no workspace-specific identifiers so it can be adapted in a public repository.',
        state: 'Located',
      },
    ],
  },
];

export function getSrpDemo(slug: string | undefined) {
  return srpDemos.find((demo) => demo.slug === slug);
}
