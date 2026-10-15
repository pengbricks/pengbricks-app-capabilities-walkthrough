# Operator Demo Steps

## Goal

Provide a repeatable operator script that connects the public reference code, a deployed release, an actual Databricks run, and the generated guide artifacts. The narration is capability-focused rather than customer- or provider-specific.

Keep the walkthrough general and provider-neutral.

## Prerequisites

- A Databricks workspace and profile authorized for the demo environment.
- Least-privilege access to the app, deployed resources, Unity Catalog metadata, and required system tables.
- A released Git commit or tag that matches the deployed bundle or app version.
- Representative public or synthetic data with no customer identifiers.
- A successful baseline run plus one controlled failure/recovery run where the guide requires it.
- Generated guide artifacts with valid immutable code and actual-run links.

## Setup

1. Select the documented environment and confirm the authenticated identity.
2. Check out the release SHA referenced by the guide.
3. Validate configuration, dependencies, and deployment definitions.
4. Deploy or confirm the exact released version in the target environment.
5. Stage the public or synthetic input data and record its version or seed.
6. Verify owners, alert destinations, permissions, schedules, and reset procedures.
7. Open the walkthrough app, Git reference, Databricks run page, and monitoring view in separate tabs.

## Standard walkthrough

| Step | Operator action | Narration | Checkpoint |
| --- | --- | --- | --- |
| 1 | Open the landing page and select a category | “Guides group reusable platform capabilities, not vendor-specific implementations.” | Light theme, category navigation, and guide status are visible. |
| 2 | Open a guide one-pager | “The one-pager defines the objective, architecture, limits, owner, and observable outcomes.” | Acceptance criteria and artifact links match the selected guide. |
| 3 | Open the immutable reference-code link | “This is the exact release used by the run, including configuration, shared code, and tests.” | Git SHA or tag matches `actual-run.json`. |
| 4 | Show configuration and reusable framework boundaries | “Source and environment differences are parameters; audit, validation, orchestration, error handling, and recovery are shared.” | No provider- or tenant-specific logic is presented as core framework behavior. |
| 5 | Start or open the representative run | “The guide links to an actual workspace execution rather than a sample screenshot.” | Resource ID, run ID, start time, terminal status, and release correlation are visible. |
| 6 | Follow the operational flow | “The run exposes validation, quarantine, retries, schedules, and shared audit context where applicable.” | Task or pipeline stages and their outputs match the one-pager. |
| 7 | Inspect governed metadata | “Unity Catalog and platform telemetry supply schema, lineage, quality, ownership, and usage documentation.” | Generated documentation links back to current metadata and the observed run. |
| 8 | Show monitoring and support routing | “Runs, failures, capacity, audit events, alerts, and ownership are connected to day-two operations.” | Monitoring period is bounded; owner and alert destination are clear. |
| 9 | Return to the guide | “The artifact record ties together intent, code, release, execution, and operational ownership.” | All completed links resolve; incomplete items are labeled `Pending`. |

## Reusable pattern narration

Use a general example to explain the reusable pattern:

1. Show a parameterized source or dataset manifest without naming a proprietary provider.
2. Identify the thin adapter boundary and shared validation, audit, quarantine, orchestration, and error-handling layers.
3. Show that a second representative dataset changes configuration and mappings, not the shared framework.
4. Explain that a new dataset or use case is a new spec file and a parameter, not new code.
5. Return to the mapped general guide.

## Failure and recovery checkpoint

For guides that require operational behavior:

1. Trigger the documented safe failure or open its recorded run.
2. Show the failed validation, quarantined record, timeout, or transient task failure.
3. Confirm alert routing and correlated audit or event-log records.
4. Retry, repair, restart, or redeploy using the supported mechanism.
5. Verify recovery without deleting the original run history.
6. Confirm that the recovered run and updated artifact retain the same release traceability.

## Reset

1. Stop active streams or scheduled triggers created for the session.
2. Remove or restore only demo-scoped data using the documented reset command.
3. Clear checkpoints only when the guide explicitly tests first-run behavior.
4. Reapply the baseline release and configuration if a failure or versioning scenario changed them.
5. Confirm the next run starts from the expected baseline and that retained audit history remains accessible.

## Troubleshooting

| Symptom | Check | Response |
| --- | --- | --- |
| Artifact link is `Pending` | Actual-run record and release workflow | Complete a real run; never substitute a fabricated link. |
| Code and run revisions differ | Git SHA, release tag, bundle/app metadata | Redeploy or rerun the matching immutable release. |
| Run link is inaccessible | Workspace, identity, permissions, retention | Use the documented environment and request least-privilege access. |
| No lineage appears | Unity Catalog objects, supported operation, capture delay | Verify governed source/target objects and document platform limitations. |
| Quality metrics are empty | Expectations, event log, time window | Confirm the run emitted metrics and use bounded queries. |
| Retry does not occur | Retry policy and failure type | Use the documented controlled transient failure and supported repair path. |
| Reset changes shared data | Scope variables and ownership | Stop immediately and use only demo-scoped catalogs, schemas, or prefixes. |

## Closeout checklist

- The audience saw the light-mode guide experience.
- The code link was immutable and matched the deployed release.
- The Databricks link opened an actual run with a terminal status.
- The documentation covered schema, lineage, quality, ownership, and usage where applicable.
- Operational ownership, alerting, recovery, limitations, and reset were stated.
- The walkthrough remained general and provider-neutral.
