# CI/CD and Environments

## Pull request

Run formatting, unit tests, type checks, bundle validation, and static checks against feed configurations and mappings.

## Development

Deploy the commit SHA through the development bundle target, run the SRP evidence job, and publish its evidence record.

## Approval

Require a reviewer to inspect the development result, quarantine outcome, retry artifact, system-table evidence, and release metadata.

## Test

Deploy the identical commit SHA through the test target. Only variables, identities, and governed resource bindings may differ.

## Rollback

Redeploy the previous immutable release or repair the current release according to the failure type. Record approval, actor, timestamps, and resulting run.
