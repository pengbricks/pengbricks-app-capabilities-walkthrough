# Reference code

Each folder under `reference/` is a self-contained Declarative Automation Bundle that backs one or more capability guides. Every bundle deploys real Databricks resources, runs on serverless compute, and produces the actual run linked from its guide.

| Bundle | Guides |
|---|---|
| `foundation/` | Owns the shared `capability_guides` schema; deploy first |
| `ingestion/` | Metadata-driven ingestion, Reusable ingestion templates, Batch and streaming ingestion, Pipeline operations |
| `monitoring/` | Platform observability |
| `developer-experience/` | Developer workflow in the IDE |
| `documentation/` | Automated data documentation |
| `legacy-conversion/` | Legacy workload migration |
| `versioning/` | Data contract versioning |
| `model-deployment/` | Model release pipeline |
| `source-ingestion/` | File format ingestion, Authenticated REST API ingestion, SFTP file retrieval, Multi-source pipeline, Relational database extracts |
| `data-engineering/` | Transformation patterns, SCD and change capture, Target loading and file outputs |
| `orchestration/` | Orchestration patterns, Lineage and drift detection |
| `analyst/` | SQL and notebooks at scale, Bring your own data, Connecting local tools, No-code data preparation, Self-service extracts and subscriptions, Charts and dashboards in the platform |
| `governance/` | Access management, Row and column security, Compute and capacity management, Cost tracking and chargeback |
| `ml-lifecycle/` | Feature preparation from source data, Training and bringing existing models, Reproducible experiments, Model quality and drift |
| `realtime-scoring/` | Online model scoring |
| `genie/` | Business terms and synonyms, Assistant user experience |
| `open-data/` | Governed data sharing, Apache Iceberg interoperability, Partner tool integrations |
| `platform-ops/` | Workspace and account administration, Support and recovery |
| `agents/` | Agents, MCP, and model gateway; Building and shipping agents |
| `ai-functions/` | AI Functions in SQL |
| `dab-starter/` | Running a Declarative Automation Bundle (a standalone starter that the guide page offers as a download; it creates its own schema) |
| `environments/` | Workspaces and catalogs across dev, test, stage, and prod (four targets that map to environment schemas in one catalog, plus a layout audit job; the four-workspace, four-catalog setup is in `setup/` as commands that the bundle does not run. It creates its own schemas) |
| `lakeflow-connect/` | SQL Server connections with Lakeflow Connect (needs a reachable SQL Server and classic compute for the gateway) |

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

Each workspace deploys its own copy. Runs, tables, and run history stay in that workspace. Deploy `foundation/` first: it creates the shared schema every other bundle writes to.

## Conventions

- **Variables:** `catalog`, `warehouse_id`, and `app_service_principal` have no defaults because they belong to the target workspace.
- **One shared schema:** every bundle writes to `capability_guides` (`dev_<user>_capability_guides` in development, `test_capability_guides` in test), owned by `foundation/`. Bundles don't declare schemas. Names other bundles also use carry a bundle prefix (for example `analyst_orders`, `source_landing`); check the schema's existing tables before adding one. The access-management guide keeps its own dev and prod demo schemas on purpose.
- **Guide folders:** each guide lives in `<bundle>/guides/<slug>/`: a `README.md` one-pager, a `00_start_here` notebook, one numbered notebook per job task, and `pipeline/` source when the guide has a pipeline. The jobs run those notebooks. Every notebook also runs on its own with Run all: blank widgets take their values from the deployed job's parameters (`_shared/guide_params.py`, copied into each bundle's `src/`, with a test that fails if a copy drifts).
- **Job parameters:** every value a notebook reads is a job-level parameter whose default comes from a bundle variable.
- **Safe to rerun:** a second run replaces its own output instead of adding to it. Sample and result tables keep their row counts; only run-log, audit, and history tables grow.
- **Compute:** serverless jobs, serverless Lakeflow Declarative Pipelines, and serverless SQL warehouses only.
- **App access:** top-level bundle `permissions` give the app service principal `CAN_RUN`, which maps to `CAN_MANAGE_RUN` on jobs. The app's quick run button triggers jobs with that identity.
- **Discovery:** every job carries the tag `capability_guide_job: <job-key>`. The app maps guides to job keys in `server/artifacts.json` and finds the deployed job by tag, so no job IDs are configured.
- **Public data:** the ML bundles (`ml-lifecycle/`, `model-deployment/`, `realtime-scoring/`) train on two UCI datasets, both CC BY 4.0. Each job downloads the zip into a volume and checks it against a pinned SHA-256 (`_shared/public_data.py`, copied into each bundle's `src/`, with a test that fails if a copy drifts). Other bundles generate sample data from a use-case spec.
  - Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D
  - Yeh, I. (2009). Default of Credit Card Clients [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C55S3H
- **Public-safe content:** no workspace hosts, IDs, credentials, customer names, or user-home paths in code or config.
