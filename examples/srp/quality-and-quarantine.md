# Quality and Quarantine

An expectation that drops rows is not a quarantine implementation.

## Parse and schema failures

Enable Auto Loader rescued data and publish records with non-null rescued payloads to a Bronze quarantine table.

## Value-rule failures

Create a normalized temporary view, then write valid and invalid records to separate governed tables. The invalid table retains:

- Raw payload and normalized fields.
- Feed, source file, and provider.
- Failed rule names and error classification.
- Job run and pipeline update correlation IDs.
- First-seen and last-updated timestamps.
- Disposition, correction reference, and replay result.

## Run artifacts

Demonstrate a threshold alert, owner notification, correction, replay, exactly-once arrival in the valid path, and linkage to the original quarantined record.
