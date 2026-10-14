# SRP Capability Walkthrough Specification

This specification treats SRP as a generic Solution Reference Pattern inside Capability Atlas. It defines reusable artifact contracts without claiming a current tenant, provider, or dataset implementation.

The content is intended for a public repository. Examples use relative paths, variables, and neutral resource names. They must not contain workspace IDs, private repository paths, credentials, customer data, internal hostnames, or environment-specific URLs.

## Scenario contract

- Representative reference batch data selected by configuration.
- Deterministic synthetic batch and incremental feeds.
- Provider-specific schemas and mappings isolated behind adapters.
- Governed Bronze, canonical Silver, and outcome-focused Gold tables.

Synthetic data is a test harness, not a production-source claim. Future tenants may supply custom datasets and mappings without changing the shared framework.

## Shared architecture

`provider adapter -> landing/bronze -> shared validation + quarantine -> silver/gold -> jobs + evidence`

Provider-specific responsibilities are restricted to connection details, source schema, mappings, normalization, and feed thresholds. Configuration validation, audit columns, quarantine, error handling, orchestration, retries, notifications, and evidence capture are shared.

## Databricks capabilities

- Lakeflow Spark Declarative Pipelines for streaming tables, materialized views, expectations, and the pipeline event log.
- Auto Loader for incremental file ingestion, rescued data, checkpoints, and schema evolution.
- Lakeflow Jobs for schedules, dependencies, retries, timeouts, run conditions, notifications, repair, and restart.
- Databricks Asset Bundles for environment variables, development/test targets, resource definitions, deployment, and release correlation.
- Unity Catalog for tables, Volumes, ownership, lineage, permissions, and governed system-table access.
- Databricks SQL alerts for quarantine and operational thresholds.

## Quarantine contract

The target pattern never treats `expect_or_drop` as quarantine. Parse and schema failures route through the Auto Loader rescued-data column. Value-rule failures split from a common normalized view into a dedicated quarantine table that retains raw payload, failed rules, feed, source file, pipeline update ID, timestamps, disposition, and replay result.

## Orchestration contract

The representative Lakeflow Job runs:

1. `generate_or_stage_demo_data`
2. `source_precheck`
3. `run_pipeline`
4. `validate_outputs`
5. `capture_evidence`
6. `capture_failure_evidence` with `AT_LEAST_ONE_FAILED`
7. `notify_owner` with `ALL_DONE`

Tasks define timeouts, `max_retries`, `min_retry_interval_millis`, and `retry_on_timeout`. A development-only controlled transient failure proves retry behavior without adding nondeterminism to production logic.

## System-table evidence

- `system.lakeflow.job_run_timeline` for scheduled runs, duration, and terminal state.
- `system.lakeflow.job_task_run_timeline` for task attempts, retries, and failures.
- `system.access.audit` for deploy, run, permission, and governance activity.
- `system.access.table_lineage` for Bronze-to-Silver-to-Gold lineage.
- `system.billing.usage` for cost and capacity attribution where tags are present.
- Native pipeline event logs for update state, flow progress, and expectation metrics.

All system-table queries must use bounded date predicates and least-privilege access.

## Run artifact record

Each verified run artifact should persist: guide slug, environment, owner, Git SHA, bundle target, resource type and ID, run ID, pipeline update ID, task key, terminal status, timestamps, Git permalink, Databricks run URL, pipeline update URL, monitoring URL, artifact URI, and recorded timestamp.

Until those fields point to an actual deployed release and run, the app displays `Pending` rather than a sample link.
