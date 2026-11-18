# Databricks Domains and Subdomains

Domains and subdomains organize data and AI assets by business purpose on the Discover page. They do not replace catalogs and schemas. Use them as a consumer-facing map and a boundary for delegated curation.

## Recommended design

- Use stable business areas such as Customer, Product, Finance, or Supply Chain.
- Keep the tree shallow. Databricks supports one top-level domain plus four subdomain levels.
- Add a subdomain only when it changes ownership, audience, or navigation.
- Assign one curator group to each branch.
- Add an asset to each domain where consumers should find it; direct membership is deliberate.
- Publish child subdomains before republishing their parent.

## Permissions

| Permission | Use |
|---|---|
| `MANAGE DISCOVER` | Account-wide domain administration for the central governance team |
| `MANAGE DOMAIN` | One domain or subdomain and its descendants |
| `MANAGE PAGES` | Page publication without permission to redesign the domain tree |

## Review checklist

- Consumers can predict where common assets belong.
- Each branch has an accountable group and review cadence.
- Every extra level improves navigation or delegation.
- Domain metadata contains no sensitive information.
- Deletion plans account for descendant subdomains.

## Documentation

- [Domains and subdomains](https://docs.databricks.com/aws/en/uc-semantics/domains)
- [Discover page](https://docs.databricks.com/aws/en/discover/discover-page)
