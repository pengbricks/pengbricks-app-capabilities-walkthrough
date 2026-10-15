# Reference-Code Artifact Plan

## Objective

Create public-safe, provider-neutral reference artifacts that let each guide connect four things: the guide steps, reusable code, generated documentation, and an actual Databricks run. Artifacts must not embed an institution, provider, or customer name.

## Design Rules

- Keep source-specific behavior in configuration, mappings, and thin adapters.
- Reuse validation, audit, quarantine, orchestration, retry, and error contracts.
- Parameterize `dataset_id`, source, target, quality policy, and environment; use neutral sample values.
- Use synthetic or openly licensed sample data only, with no workspace identifiers, credentials, or customer metadata in Git.
- Link code to an immutable commit SHA and runs to the corresponding Databricks job or pipeline update.
- Call all deliverables **artifacts** in the app, repository, automation, and documentation.

## Proposed Artifact Layout

```text
artifacts/
  manifest.schema.json
  guides/<guide-slug>/
    artifact.yml
    README.md
    runbook.md
    expected-results.md
reference/
  config/
    datasets/<dataset>.yml
    mappings/<dataset>.yml
    environments/{dev,test}.yml
  pipelines/
    parameterized_ingestion.py
    quality_and_quarantine.py
  orchestration/
    job.yml
    retry_policy.yml
  governance/
    audit_queries.sql
    lineage_queries.sql
  shared/
    audit.py
    validation.py
    errors.py
  tests/
    contract/
    fixtures/
```

Existing public-safe examples may be promoted into this structure incrementally; links should point to their current path until promotion is complete.

## Core Reference Artifacts

### 1. Configuration and mappings

- Define a versioned dataset manifest for source format, schema, target, ownership, quality policy, and processing mode.
- Define canonical field mappings separately from pipeline code.
- Add two neutral representative datasets to show configuration-only onboarding.
- Validate manifests against `manifest.schema.json` before deployment.
- Record the manifest version and checksum in every run artifact.

### 2. Parameterized pipelines

- Implement one pipeline factory driven by `dataset_id`, `environment`, and manifest path.
- Support batch as the primary path and a compatible streaming mode without duplicating transformation logic.
- Add standard correlation, source, ingestion-time, release, and configuration-version fields.
- Keep adapter interfaces narrow: read, normalize, and return the canonical input contract.

### 3. Quality and quarantine

- Express quality rules in dataset configuration and apply them through one shared validation engine.
- Route invalid records to a governed quarantine table with rule, reason, run, dataset, and source metadata.
- Include a deterministic failure fixture and a replay step after correction.
- Document expected accepted, rejected, and replayed record counts.

### 4. Orchestration and retries

- Define scheduled Lakeflow Jobs orchestration with parameter passing, task dependencies, notifications, and bounded retries.
- Demonstrate one retryable failure and one terminal validation failure.
- Capture restart behavior, repair-run steps, and idempotency expectations in the runbook.
- Keep environment values in deployment targets rather than source code.

### 5. System-table audit queries

- Add public-safe SQL templates for job history, pipeline updates, audit events, lineage, billing usage, and query history where available.
- Filter queries by parameters such as workspace, job, pipeline, release SHA, and time window rather than hard-coded IDs.
- Document required Unity Catalog system-table privileges and regional availability.
- Export only redacted result summaries or screenshots; the live run URL remains the authoritative operational record.

### 6. CI/CD

- Validate configuration schemas, mappings, Python, SQL, and contract tests on pull requests.
- Deploy the same immutable release to development and test with environment-specific variables.
- Require approval before test promotion and retain the workflow run, commit SHA, bundle deployment identity, and Databricks run IDs.
- Fail publication when a guide lacks a valid code link, actual run link, artifact owner, or refresh timestamp.

## Artifact Manifest Contract

Each `artifact.yml` should contain:

```yaml
guide_slug: configuration-vs-code
artifact_version: 1
release_sha: <git-commit-sha>
code:
  - label: Parameterized ingestion pipeline
    url: https://github.com/pengbricks/<repo>/blob/<sha>/reference/pipelines/parameterized_ingestion.py
documentation:
  one_pager: README.md
  demo_steps: runbook.md
runs:
  - environment: dev
    type: pipeline_update
    url: <authenticated-databricks-run-url>
    run_id: <run-id>
    started_at: <iso-8601>
    status: succeeded
configuration:
  dataset_id: representative_feed_a
  manifest_version: 1
owner: <team-or-role>
refreshed_at: <iso-8601>
```

The public repository stores the contract and safe metadata. Run URLs may require authentication, but must resolve to the actual job run or pipeline update rather than a landing page. If a run cannot be shared publicly, label the access requirement and provide a redacted generated summary alongside it.

## Delivery Sequence

1. Define `manifest.schema.json` and `artifact.yml` validation.
2. Add two neutral dataset manifests and canonical mappings.
3. Build the shared parameterized ingestion and quarantine paths.
4. Add scheduled orchestration, retry, repair, and replay examples.
5. Add parameterized system-table audit query templates.
6. Add contract tests and CI validation for every artifact link.
7. Run development and test deployments from one release SHA.
8. Populate actual run URLs and publish the guide one-pagers.

## Guide Completion Checklist

- One-page guide states the capability, prerequisites, architecture, steps, expected result, and cleanup.
- Reference code link is public, commit-pinned, and contains no environment-specific identifiers.
- Actual run link matches the artifact release SHA and configuration version.
- Demo steps include success, controlled failure, retry or repair, quarantine review, and audit review where relevant.
- Documentation identifies Databricks capabilities used, required permissions, owner, limitations, and refresh date.
- A second dataset is onboarded through configuration and mappings without changes to shared framework code.

## Exit Criteria

The first artifact set is complete when the configuration-vs-code and reusability guides each show two datasets using the same shared framework, one controlled quarantine path, one scheduled run with retry evidence, system-table audit results, CI/CD traceability, immutable public code links, and authenticated links to actual Databricks runs.
