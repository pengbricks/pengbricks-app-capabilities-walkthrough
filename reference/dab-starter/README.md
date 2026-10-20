# dab-starter

A small Declarative Automation Bundle (formerly Databricks Asset Bundles) you can deploy and run in about ten minutes. It holds:

- a serverless Lakeflow Declarative Pipeline that generates 100,000 synthetic orders with [dbldatagen](https://databrickslabs.github.io/dbldatagen/public_docs/index.html) (bronze), drops the rows that break a rule (silver), and totals revenue per day and category (gold)
- a job that runs the pipeline, then checks the row counts and prints the expectation results
- a `dev` target (the default) and a `prod` target
- a GitHub Actions workflow that validates pull requests and deploys `main`

Everything runs on serverless compute.

## What you need

- A Databricks workspace with Unity Catalog and serverless compute
- A catalog where you can create a schema (`USE CATALOG` and `CREATE SCHEMA`)
- A recent Databricks CLI, tested with v1.17.0. Check with `databricks --version`; install or upgrade from <https://docs.databricks.com/aws/en/dev-tools/cli/install>
- Git, and a GitHub account if you want the CI workflow

Sign in once. This opens a browser and saves a profile:

```bash
databricks auth login --host https://<your-workspace-host>
```

Pass `--profile <name>` to every command below if you have more than one profile.

## Put it in your own Git repo

Unzip the download, then:

```bash
cd dab-starter
git init -b main
git add .
git commit -m "Add the dab-starter bundle"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Create the empty repo on GitHub first. The bundle never reads from Git: `bundle deploy` uploads the files in your folder. Git is where the team reviews and versions them.

## Validate, deploy, run

```bash
databricks bundle validate --var catalog=<catalog>
databricks bundle deploy --var catalog=<catalog>
databricks bundle run capability_guides_dab_starter --var catalog=<catalog>
```

`validate` checks the YAML and your workspace access. `deploy` uploads the files and creates the schema, pipeline, and job. `run` starts the job and prints a run URL. Expect two to three minutes.

To skip repeating `--var`, run `export BUNDLE_VAR_catalog=<catalog>` once per shell.

## Find the results

- **Run:** open the URL `bundle run` printed, or go to Jobs & Pipelines and open `[dev <you>] dab-starter-orders`.
- **Pipeline:** Jobs & Pipelines, then `[dev <you>] dab-starter-orders`. The graph shows `orders_bronze`, `orders_silver`, and `orders_daily_revenue`. Select `orders_silver` to see how many rows each expectation dropped.
- **Tables:** Catalog Explorer, `<catalog>` then `dev_<you>_dab_starter`. Or query them:

  ```sql
  SELECT * FROM <catalog>.dev_<you>_dab_starter.orders_daily_revenue ORDER BY order_date DESC LIMIT 10;
  ```

The `dev` target is in development mode: resource names start with `[dev <you>]`, the schema is named `dev_<you>_dab_starter`, and the job's daily schedule is paused. Two people can deploy the same bundle without colliding.

## Change something and redeploy

Open `databricks.yml` and set a different default for `row_count`, or pass it on the command line:

```bash
databricks bundle deploy --var catalog=<catalog> --var row_count=250000
databricks bundle run capability_guides_dab_starter --var catalog=<catalog> --var row_count=250000
```

Bronze now has 250,000 rows. Deploy only changes what differs from the last deploy. Edit `guides/dab-starter/pipeline/orders.py` to add a rule to silver, deploy, and run again.

## Deploy to prod

```bash
databricks bundle validate --strict -t prod --var catalog=<catalog>
databricks bundle deploy -t prod --var catalog=<catalog>
databricks bundle run capability_guides_dab_starter -t prod --var catalog=<catalog>
```

Production mode creates a second, separate copy: names have no prefix, the schema is `dab_starter`, the schedule (daily at 06:00 UTC) is live, and the files go to a fixed path under your user folder. Dev and prod do not share tables.

For a real production deployment, deploy as a service principal and add `run_as` to the `prod` target so scheduled runs do not depend on a person.

## Run the tests

The helper code in `src/` has plain pytest tests that need no Spark:

```bash
pip install pytest
pytest tests
```

## Deploy from GitHub Actions

`.github/workflows/bundle.yml` validates every pull request and deploys `main` to prod. It signs in as a service principal through OAuth. Add these in your repo under Settings, Secrets and variables, Actions:

| Name | Type | Value |
|---|---|---|
| `DATABRICKS_HOST` | secret | Your workspace URL |
| `DATABRICKS_CLIENT_ID` | secret | Application ID of a service principal |
| `DATABRICKS_CLIENT_SECRET` | secret | An OAuth secret for that service principal |
| `DATABRICKS_CATALOG` | variable | The catalog from above |

Give the service principal `USE CATALOG` and `CREATE SCHEMA` on the catalog. Never commit a token or a secret to the repo.

## Clean up

```bash
databricks bundle destroy --var catalog=<catalog>
databricks bundle destroy -t prod --var catalog=<catalog>
```

`destroy` deletes the job, the pipeline, the deployed files, and the schema with its tables. It asks you to confirm first.

## What is in the folder

| Path | What it is |
|---|---|
| `databricks.yml` | Bundle name, variables, and the `dev` and `prod` targets |
| `resources/orders.pipeline.yml` | The serverless pipeline, with `dbldatagen` as a dependency |
| `resources/orders.job.yml` | The job: pipeline task, then a check notebook |
| `resources/orders.schema.yml` | The schema the tables land in |
| `guides/dab-starter/pipeline/orders.py` | The pipeline source |
| `guides/dab-starter/00_start_here.py`, `01_check_gold.py` | Notebooks the job and you can open in the workspace |
| `src/` | Helper code for the notebooks, and its tests in `tests/` |
| `.github/workflows/bundle.yml` | Validate on pull request, deploy on `main` |
