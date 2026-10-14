# Documentation Artifacts Plan

## Goal

Give every guide a concise one-pager, runnable reference code, and a link to an actual Databricks run. Artifacts must be safe for a public repository, reproducible from a tagged release, and explicit when a run has not yet been completed.

Guides stay general and provider-neutral. Future tenant, dataset, and schema differences will be supplied through configuration after the multi-tenant contract is defined.

## Standard artifact set

Each guide owns the following versioned artifacts:

| Artifact | Purpose | Required contents |
| --- | --- | --- |
| `one-pager.md` | Explain the capability in one screen | Objective, business value, architecture, Databricks capabilities, demo checkpoints, limitations, owner, and related links |
| `reference-code.md` | Point to runnable implementation | Immutable Git permalink, entry point, configuration contract, tests, expected outputs, and environment variables |
| `actual-run.json` | Bind documentation to an observed run | Guide slug, environment, Git SHA, release tag, Databricks resource and run IDs, status, timestamps, run URL, artifact URLs, and recorded timestamp |
| `data-contract.md` | Document governed inputs and outputs | Schema, constraints, compatibility policy, sensitive-data classification, and sample usage |
| `operations.md` | Support repeatable operation | Prerequisites, setup, run, reset, retry/recovery, alert route, owner, and troubleshooting |

Use `Pending` rather than example or fabricated URLs until an actual deployed run exists. Run links should target workspace records while repository links should use immutable commits or release tags.

## Generated data documentation

For guides that create or consume governed data, generate and refresh:

- **Schema:** columns, types, nullability, keys, descriptions, classifications, and contract version.
- **Lineage:** source-to-target relationships, producing job or pipeline, transformation entry point, and Unity Catalog lineage link.
- **Quality:** rules, thresholds, expectation results, quarantine counts, exception disposition, and most recent validation run.
- **Ownership:** business owner, technical owner, support route, steward, access approver, and review date.
- **Usage:** intended consumers, SQL or API examples, freshness, service expectations, cost considerations, and known limitations.

Prefer metadata from Unity Catalog, pipeline event logs, job runs, and bounded system-table queries. Store generated Markdown and machine-readable JSON together so the app can render the same source used by automation.

## Proposed layout

```text
artifacts/
  guides/<guide-slug>/
    one-pager.md
    reference-code.md
    actual-run.json
    operations.md
    data-contract.md
    generated/
      schema.json
      lineage.json
      quality.json
      ownership.json
      usage.md
```

The app reads an artifact index rather than embedding guide-specific links in components. Tenant or dataset keys remain optional reserved fields until the multi-tenant design is implemented.

## Generation workflow

1. Validate the guide manifest and public-content policy.
2. Build and test the reference implementation at an immutable Git SHA.
3. Deploy the same release through the documented automation path.
4. Execute the representative Databricks job, pipeline, query, endpoint, or app flow.
5. Confirm the terminal state and capture durable workspace run links.
6. Query governed metadata for schema, lineage, quality, ownership, and operational facts.
7. Generate the one-pager and supporting Markdown/JSON from templates.
8. Validate that every link resolves and that run metadata matches the release SHA.
9. Publish the artifact index consumed by the walkthrough app.

## Template requirements

Every one-pager answers:

1. What capability is being demonstrated?
2. Which parts are configuration and which are reusable code?
3. Which Databricks capabilities are involved?
4. What should the viewer observe during the run?
5. Which reference code and actual run support the guide?
6. What is GA, preview, environment-specific, or not yet implemented?
7. Who owns operation and how is the artifact refreshed?

## Validation and refresh

- Fail publication when a claimed completed guide lacks an immutable code link or successful actual-run record.
- Detect stale run links, missing owners, changed schemas, and documentation older than the release.
- Redact credentials, customer identifiers, private hosts, workspace IDs in prose, and non-public repository paths.
- Refresh on release, contract change, ownership change, or scheduled metadata review.
- Retain prior versions for traceability and mark superseded artifacts without deleting their run history.

## Delivery sequence

1. Define the artifact schemas and one-pager template.
2. Implement one representative guide end to end.
3. Add metadata collectors and link validation.
4. Generate artifacts for the remaining guides by category.
5. Add CI checks for completeness, freshness, and public safety.
6. Connect the app cards and detail pages to the artifact index.

