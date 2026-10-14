# Reference code

Each folder under `reference/` is a self-contained Declarative Automation Bundle that backs one or more capability guides. Every bundle deploys real Databricks resources, runs on serverless compute, and produces the actual run linked from its guide.

| Bundle | Guides |
|---|---|
| `ingestion/` | Configuration vs code, Reusability / templatization, Batch and real-time ingestion, DataOps |
| `monitoring/` | Monitoring |
| `developer-experience/` | IDE and developer experience |
| `documentation/` | Documentation generation |
| `legacy-conversion/` | Legacy conversion |

The GitHub integration and CI/CD guide deploys the `ingestion/` bundle through `.github/workflows/reference-cicd.yml`.

## Deploy a bundle

```bash
cd reference/<bundle>
databricks bundle validate --strict --target dev --profile <profile> \
  --var catalog=<catalog> --var warehouse_id=<warehouse-id> \
  --var app_service_principal=<app-service-principal-application-id>
databricks bundle deploy --target dev --profile <profile> --var ...
databricks bundle run <job-key> --target dev --profile <profile> --var ...
```

Each workspace deploys its own copy. Runs, tables, and run history stay in that workspace.

## Conventions

- **Variables:** `catalog`, `warehouse_id`, and `app_service_principal` have no defaults because they belong to the target workspace. Schema names default to `capability_guides_<bundle>` and may be overridden.
- **Compute:** serverless jobs, serverless Lakeflow Declarative Pipelines, and serverless SQL warehouses only.
- **App access:** top-level bundle `permissions` give the app service principal `CAN_RUN`, which maps to `CAN_MANAGE_RUN` on jobs. The app's quick run button triggers jobs with that identity.
- **Discovery:** every job carries the tag `capability_guide_job: <job-key>`. The app maps guides to job keys in `client/src/data/artifacts.ts` and finds the deployed job by tag, so no job IDs are configured.
- **Public-safe content:** no workspace hosts, IDs, credentials, customer names, or user-home paths in code or config.
