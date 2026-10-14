# Actual-Run Artifact Plan

Every guide must link its reference code and walkthrough to an actual execution. The unit is an **artifact**: a small, typed record that connects a guide, release, environment, Databricks resource, immutable run identifier, and supporting outputs. Screenshots may illustrate an artifact, but they never replace the underlying run link or machine-readable record.

Future multi-tenant use cases may supply tenant-specific datasets, generated schemas, and runs through the same generic guide and artifact interfaces.

## Per-guide artifact set

Each guide one-pager publishes four related items:

1. **Reference code**: an immutable Git permalink at the recorded commit.
2. **Actual run**: an authenticated deep link to the exact run, update, request trace, or audit-backed operation.
3. **Documentation**: architecture, prerequisites, configuration, security, limitations, and cleanup notes.
4. **Demo steps**: setup, execute, inspect, failure or variation, and reset steps with expected results.

One artifact is designated `primary`; additional artifacts can cover failure, recovery, comparison, promotion, or a second integration. Intentional failure demonstrations are valid only when the expected failure and the successful recovery are both recorded.

## Run-link contract

- Use an HTTPS deep link to an immutable identifier such as a job run, pipeline update, SQL statement, MLflow run, serving trace/request, app deployment, or audit event query. Do not link to `latest`, a resource landing page, a search result, or a screenshot alone.
- Direct Databricks workspace run URLs are allowed and preferred when they identify the actual execution. Never embed tokens, credentials, customer identifiers, or user-home paths in those URLs.
- Record the stable resource ID separately from the execution ID. A resource configuration page is supplemental and cannot be the primary actual-run link.
- Correlate every run to the same `git_sha`, release version, bundle target, and environment shown on the guide.
- Require terminal state and start/end timestamps. For continuously running resources, record a bounded observation window and checkpoint or update identifier.
- Open workspace links in a new tab and label them as authenticated Databricks links. The UI must handle insufficient access without implying that the run is missing.
- Validate link shape and identifier presence automatically; verify the resource and run through the Databricks API before publishing `Verified`.

## Databricks run types

| Resource | Immutable execution reference | Typical companion artifacts |
| --- | --- | --- |
| Lakeflow Job | `job_id`, `run_id`, optional `task_run_id` | task graph, retry/repair history, duration, logs |
| Lakeflow Spark Declarative Pipeline | `pipeline_id`, `update_id` | event-log query, expectation metrics, lineage, checkpoint window |
| Databricks SQL | statement/query-history ID | SQL permalink, result summary, warehouse and duration metrics |
| MLflow experiment | experiment ID and `run_id` | parameters, metrics, dataset/code references, environment |
| Unity Catalog model | full model name and model version | alias transition, approval record, MLflow source run |
| Model Serving / AI Gateway | endpoint config version plus request or trace ID | latency, token/usage, policy, fallback, response status |
| Databricks App | deployment/release ID plus bounded request/log trace | health result, release SHA, application logs |
| Unity Catalog data object | full object name plus table version or operation timestamp | history, schema, grants, lineage, quality results |
| AI/BI dashboard or alert | dashboard identity plus query/refresh or alert event ID | bounded system-table queries, routed notification |
| Delta Sharing | share/recipient identity plus query and audit-event correlation | entitlement, revocation, recipient access result |
| Workspace/account administration | audit event ID or bounded audit query | policy/config snapshot, actor role, resulting state |
| GitHub automation | workflow run ID correlated to the Databricks release | approval, environment, artifact digest, deploy output |

## Guide coverage

| Guide | Primary actual-run artifacts |
| --- | --- |
| Configuration vs code | Parameterized job run and pipeline update using the shared validation, audit, quarantine, orchestration, and error path |
| Reusability / templatization | Two comparable feed runs at one release SHA, with a configuration/mapping-only diff |
| Batch and real-time ingestion | Batch job run plus a bounded streaming pipeline update with latency, throughput, scaling, and checkpoint metrics |
| IDE and developer experience | Test workflow run plus the resulting notebook, SQL, Python, job, or pipeline execution |
| GitHub integration and CI/CD | One approved GitHub workflow correlated to development and test deployments of the same release |
| Versioning | Compatibility test runs for nonbreaking and breaking changes, plus the deployed version/deprecation record |
| Model deployment and CI/CD | Approved model version, automated test run, deployment workflow, endpoint configuration, and inference trace |
| DataOps | Failed run, routed alert, retry/repair or restart, and rollback/redeployment run across named environments |
| Documentation generation | Documentation-generation job and bounded metadata queries producing schema, lineage, quality, ownership, and usage outputs |
| Monitoring | Dashboard refresh/query artifacts and an alert event covering runs, failures, usage, compute, audit, and routing |
| User experience | Bounded app session/request traces plus sanitized task outcomes, feedback, issues, and training actions |
| Ontology | Before/after evaluation runs using the same questions, with concept/synonym version and comparison metrics |
| Agent framework support | Governed MCP trace, cross-agent handoff trace, two-model gateway requests, policy/limit events, usage cost, and fallback trace |
| Ease of agent build and deployment | Assistant build/test run, approved deployment, app or serving release, request trace, and operational dashboard link |
| Data ingestion and feature preparation | Ingestion/pipeline update, quality results, versioned feature input, and source-to-feature lineage |
| Model training and compatibility | MLflow training or load run, baseline comparison run, registered version, and runtime/library manifest |
| Experiment tracking and reproducibility | Original and replayed MLflow runs with identical tracked references and tolerance comparison |
| Real-time or on-demand scoring | Authenticated serving trace with response, latency, scaling observation, and controlled failure response |
| Model performance and drift monitoring | Monitoring refresh, simulated threshold breach, alert event, and owner review or retraining workflow run |
| Operational support | Incident-triggering run, triage artifacts, restart/recovery run, escalation record, and final health check |
| Iceberg support | SQL or job runs for write/read/evolution/time travel plus catalog metadata and supported external-access result |
| External tool integrations | One execution artifact for each of two integrations, with identity, transfer/query result, and audit correlation |
| Legacy conversion | Assessment/conversion run, generated coverage report, remediation diff, and regression test run |
| Data sharing | Share/recipient operation, entitled access query, revocation event, denied follow-up query, and replication note |
| Platform administration | Audit-backed setup, role, policy, capacity, and routine-support operations with before/after configuration snapshots |

## Run ledger

Store one record per artifact in a governed table or versioned JSON export. The application consumes only a public-safe projection.

| Field group | Required fields |
| --- | --- |
| Identity | `artifact_id`, `guide_slug`, `artifact_role`, `artifact_type`, `title` |
| Release | `release_version`, `git_sha`, `code_permalink`, `bundle_target`, `artifact_digest` |
| Environment | `environment`, `workspace_alias`, `region`, `owner` |
| Resource | `resource_type`, `resource_key`, `resource_id` |
| Execution | `run_id`, optional `task_run_id`/`update_id`/`request_id`/`trace_id`, `terminal_status`, `started_at`, `ended_at` |
| Links | `run_path`, `documentation_path`, `metrics_uri`, `logs_uri`, optional `screenshot_uri` |
| Verification | `state`, `expected_outcome`, `verified_by`, `verified_at`, `verification_method`, `recorded_at` |
| Safety | `data_classification`, `synthetic_or_public_data`, `redaction_status`, `public_summary` |

The public projection omits raw workspace IDs, actor identities, request bodies, private URLs, and unrestricted logs. The backend converts allowlisted `workspace_alias + run_path` values into links at runtime.

## Supporting outputs

- **Screenshots**: optional, cropped to the relevant state, timestamped, accessible, and redacted. Record the source artifact ID and capture time.
- **Metrics**: preserve structured JSON, CSV, MLflow metrics, pipeline event-log results, or bounded system-table query results. Include units, time window, aggregation, and thresholds.
- **Logs**: retain only the minimal relevant excerpt or governed log URI. Include task/request correlation and timestamps; exclude secrets, tokens, payloads, PII, and unrelated tenant data.
- **Documentation and demo steps**: pin to the same release SHA as the run. State prerequisites, expected outputs, cleanup, preview/GA status where relevant, and any region or feature limitations.

## Pending and verified

The public UI exposes two states:

- `Pending`: no real execution exists; the run is incomplete or failed unexpectedly; a link is placeholder/latest; required artifacts are missing; the link cannot be validated; or release, environment, and code correlation do not match.
- `Verified`: the expected terminal outcome occurred on an actual resource, immutable IDs resolve, release and environment fields match, required metrics/logs are present, public-safety checks pass, and automated verification plus a recorded owner/reviewer check are complete.

A successful screenshot or sample output cannot promote a record. A deliberately failed run can be part of a verified guide only when `expected_outcome` declares the failure and a correlated recovery artifact is also verified. Any material rerun, release change, resource replacement, or invalid link returns the affected artifact to `Pending` until reverified.

## Delivery sequence

1. Define the ledger schema, public projection, link templates, and JSON validation.
2. Add reusable capture adapters for jobs, pipelines, SQL, MLflow, serving, apps, Unity Catalog, system tables, and GitHub workflows.
3. Add a verifier that checks immutable IDs, terminal outcomes, release correlation, required outputs, and redaction status.
4. Connect each guide one-pager to reference code, documentation, demo steps, and its primary/supplemental artifacts.
5. Populate development artifacts, promote the same release where required, and leave every unexecuted guide explicitly `Pending`.
6. Add scheduled freshness checks and mark invalidated artifacts `Pending` without deleting their history.
