# Capability Atlas

A public, light-theme Databricks application for organizing 25 capability guides across CI/CD and version control, governance and monitoring, AI, ML, ingestion, and general demonstrations. React and AppKit UI power the frontend; FastAPI serves the production frontend and future backend APIs.

Every guide uses the same evidence contract:

1. A concise one-page guide.
2. A versioned reference implementation.
3. A link to the actual Databricks run and trace.

Guides are general and not tied to a tenant, provider, or dataset. Multi-tenant support with generated, use-case-specific schemas is a future extension. Code and run links remain visibly pending until real artifacts are connected.

## Local development

```bash
npm install
python -m pip install -r requirements.txt
npm run build:client
python -m server.app
```

Open `http://localhost:8000/capability-guides/`.

For frontend hot reload, run `npm run dev:client` separately; `/api` requests proxy to FastAPI on port 8000.

## Quality checks

```bash
npm test
npm run test:python
npm run typecheck
npm run lint
npm run build
```

## Project structure

- `client/src/data/guides.ts` — capability guides, acceptance criteria, and evidence requirements.
- `client/src/pages/HomePage.tsx` — searchable, filterable guide landing page.
- `client/src/pages/GuidePage.tsx` — reusable one-page guide layout and evidence slots.
- `server/app.py` — FastAPI health API and production SPA server.
- `server/artifacts.py` and `server/artifacts.json` — guide artifacts, run discovery, and quick runs.
- `reference/` — deployable reference bundles behind each guide.
- `child-app.json` — Pengbricks child runtime and route contract.
- `single-child-wrapper.json` — thin-wrapper export contract.

## Guide artifacts

Reference code for each guide lives in `reference/<bundle>/` as a deployable bundle; see `reference/README.md`. The app reads `server/artifacts.json` for each guide's one-pager, code links, documentation links, key-function highlights, and job keys.

- **Actual runs:** the backend finds each workspace's deployed jobs by their `capability_guide_job` tag and lists recent runs. The **Quick run** button starts a job as the app service principal, which needs `CAN_MANAGE_RUN` (granted by each bundle's `app_service_principal` variable).
- **Run history:** set `CAPABILITY_GUIDES_LAKEBASE_ENDPOINT`, `CAPABILITY_GUIDES_LAKEBASE_DATABASE`, and optionally `CAPABILITY_GUIDES_LAKEBASE_SCHEMA` to record runs in that workspace's Lakebase database. Without them, history comes from the Jobs API.
- **Recorded runs:** `recordedRuns` in `server/artifacts.json` are the fallback links shown when the app cannot reach a workspace.
- **Key functions and dates:** `npm run build` first runs `scripts/build_artifact_snippets.py`, which embeds highlighted code, function docstrings for hover text, Auto Loader samples, and each guide's last updated date from Git. `npm run test:python` fails when snippets are stale.

## Public repository rules

- Actual Databricks workspace run URLs and resource IDs may be versioned; never include tokens, credentials, private repository paths, customer data, or user-home paths.
- Use Databricks Asset Bundle variables, app resources, and profile-driven deployment for environment-specific values.
- Treat examples as guidance; mark a guide verified only after connecting immutable code and an actual Databricks run.

## Pengbricks wrapper

This repository is a child feature app. It intentionally owns no `app.yaml` or root `databricks.yml`; the Pengbricks wrapper owns the single Databricks App, deployment bundle, external port, and reverse proxy.

The validated `client/runtime/` build is pinned for the shared Python-child runtime. Rebuild it with `npm run build` whenever frontend source changes, then update the tracked build artifacts.

## Standalone deployment

Suffixed deployment templates are included so Pengbricks child discovery never treats this repository as a second Databricks App or root bundle.

```bash
cp app.yaml.standalone app.yaml
cp databricks.yml.standalone databricks.yml
databricks bundle validate --strict --target dev --profile <profile>
databricks bundle deploy --target dev --profile <profile>
```

The copied `app.yaml` and `databricks.yml` are ignored by Git. The standalone root redirects to `/capability-guides/`; override `--var app_name=<workspace-unique-name>` when needed.

Deployment is intentionally not performed by this template task.
