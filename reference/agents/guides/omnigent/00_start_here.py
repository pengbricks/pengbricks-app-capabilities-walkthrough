# Databricks notebook source
# MAGIC %md
# MAGIC # Omnigent: connect GitHub and let it build a pipeline
# MAGIC
# MAGIC This guide lands raw files in a Unity Catalog volume, then has Omnigent build a Lakeflow pipeline from them as a Declarative Automation Bundle in a GitHub repository. Omnigent works on a feature branch, deploys the bundle to dev, runs the pipeline, and opens a pull request. A check notebook reconciles the resulting tables to the raw files.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Step | What it does |
# MAGIC |---|---|
# MAGIC | `01_preflight_raw_volume` | Creates the volume `omnigent_raw` if missing and writes `orders.csv`, `customers.json`, and `events/` to fixed paths with a fixed seed. Prints the paths and the Omnigent prompts. |
# MAGIC | `prompts.md` | The exact prompts to paste into Omnigent. You run these by hand in Omnigent. |
# MAGIC | `02_check_pipeline` | Finds the pipeline by name prefix and the `omni_` bronze, silver, and gold tables, and reconciles row counts to the raw files. Reports `needs_manual_check` when the Omnigent steps have not run yet. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC 1. Run the job `capability-guides-omnigent` once. The check reports `needs_manual_check` because the pipeline does not exist yet.
# MAGIC 2. Connect GitHub to Omnigent and Databricks as the guide describes, then paste the prompts from `prompts.md` into Omnigent.
# MAGIC 3. Run the job again. The check now reconciles the tables to the raw files.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the shared guide schema. |
# MAGIC | `schema` | Shared guide schema. The volume and the `omni_` tables live here. |
# MAGIC | `volume` | Volume for the raw files. Default `omnigent_raw`. |
# MAGIC | `seed` | Seed for the raw files. Default `42`. The same seed gives the same files. |
# MAGIC | `table_prefix` | Prefix of the pipeline's tables. Default `omni_`. |
# MAGIC | `pipeline_prefix` | Prefix of the pipeline name. Default `omnigent_`. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: this notebook only describes the guide.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Foundation bundle.** Deploy `reference/foundation` first. It creates the shared schema.
# MAGIC 2. **Volume privilege.** The preflight creates a volume in the shared schema:
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG <catalog> TO `<principal>`;
# MAGIC    GRANT USE SCHEMA, CREATE VOLUME, CREATE TABLE ON SCHEMA <catalog>.<schema> TO `<principal>`;
# MAGIC    ```
# MAGIC    The identity that runs Omnigent's bundle deploy needs the same `CREATE TABLE` on the schema, plus `READ VOLUME` on `omnigent_raw`.
# MAGIC 3. **An Omnigent server.** Use Omnigent on Databricks (Beta) or a server you run on Databricks Apps. You need an account on it and permission to start a session.
# MAGIC 4. **A GitHub repository and connection.** A repository you can push branches to, and a GitHub account connected to Omnigent (Settings, then Sandbox Integrations, then Connect GitHub). A self-managed server needs the GitHub App registered and its `OMNIGENT_GITHUB_APP_*` settings in place.
# MAGIC 5. **Policy.** A `github_policy` that limits writes to your repository and to `feature/*` branches.
# MAGIC 6. **Git credentials.** A Git credential for the identity that runs code in Databricks:
# MAGIC    ```bash
# MAGIC    databricks git-credentials list
# MAGIC    databricks git-credentials create gitHub --git-username <github-user> --personal-access-token <token>
# MAGIC    ```
# MAGIC 7. **Serverless compute.** The job, the Omnigent bundle's pipeline, and the check all run on serverless compute.
# MAGIC
# MAGIC Nothing in this guide is created at the account level.
# MAGIC
# MAGIC ## Cleanup
# MAGIC
# MAGIC The raw volume and the `omni_` tables cost only storage. To remove the pipeline Omnigent deployed, run `databricks bundle destroy --target dev` in the cloned repository, or ask Omnigent to do it. Delete the volume with `DROP VOLUME IF EXISTS <catalog>.<schema>.omnigent_raw` when you finish.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params

params = load_params(dbutils, "capability_guides_omnigent", ["catalog", "schema"])

# COMMAND ----------

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
jobs = [j for j in w.jobs.list() if (j.settings.tags or {}).get("capability_guide_job") == "capability_guides_omnigent"]
for job in jobs:
    print(f"Job: {job.settings.name}  {w.config.host}/jobs/{job.job_id}")
if not jobs:
    print("The job is not deployed yet. Run: databricks bundle deploy --target dev")
