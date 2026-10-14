# Recovery Runbook

1. Trigger the representative Lakeflow Job through its configured schedule.
2. Enable a development-only transient-failure parameter for the source-precheck task.
3. Record attempt one as failed in the evidence ledger.
4. Allow the configured retry policy to execute attempt two.
5. Verify pipeline, validation, and evidence tasks complete successfully.
6. Confirm failure and completion notifications reach the configured destination.
7. For a persistent failure, repair or restart from the failed task after correcting the issue.
8. Record operator, timestamps, release SHA, task attempts, recovery action, and final state.

Failure injection must be deterministic, development-only, and isolated from production transformation logic.
