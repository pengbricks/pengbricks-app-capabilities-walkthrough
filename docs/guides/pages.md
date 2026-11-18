# Databricks Pages

A Page is a governed, authoritative definition of a business term, entity, KPI, or acronym. Pages live in domains and subdomains. Genie One prioritizes a matching published Page over conflicting learned context and cites it in the answer.

## Recommended content

- A canonical name and short description.
- A named concept owner.
- Synonyms collected from real questions and reports.
- Scope, exclusions, lifecycle states, guardrails, and examples.
- Sources that establish provenance.
- Related metric views, tables, dashboards, agents, and Pages.

Keep executable KPI logic in a metric view and link it from the Page.

## Governance

- Create a draft and review its evidence with the concept owner and data steward.
- Publish through a steward group with `MANAGE PAGES`.
- Ask a domain curator to certify the Page after its definition and implementation agree.
- Deprecate stale Pages rather than leaving conflicting definitions active.
- Keep PII, regulated data, secrets, and customer records out of Page metadata.

## Automation

The Pages REST API supports lifecycle management. Create drafts, use explicit update masks, provide request IDs for retry safety, require review before publication, and read the deployed Page back after each change.

## Documentation

- [Pages](https://docs.databricks.com/aws/en/uc-semantics/pages)
- [Pages REST API](https://docs.databricks.com/api/workspace/knowledge/pages)
- [Certify or deprecate assets](https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data)
