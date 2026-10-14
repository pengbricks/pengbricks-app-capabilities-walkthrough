# Public SRP Examples

These examples support the standalone SRP specification in Capability Atlas. They are intentionally portable and contain no workspace identifiers, credentials, private URLs, customer data, or claims of successful execution.

## Contents

- `architecture.md` — reusable framework and provider boundary.
- `data-foundation.md` — representative reference sources and synthetic operational feeds.
- `quality-and-quarantine.md` — invalid-row preservation and replay contract.
- `recovery-runbook.md` — controlled retry, repair, and restart scenario.
- `evidence-contract.md` — metadata required before a run can be marked verified.
- `cicd-and-environments.md` — portable development-to-test promotion design.
- `config/feeds/` — generic provider A and provider B feed configuration.
- `resources/orchestration.job.yml` — illustrative Lakeflow Job resource fragment.
- `sql/system-table-evidence.sql` — bounded system-table evidence queries.

Resource names and paths use placeholders. Adapt them through Databricks Asset Bundle variables before deployment.
