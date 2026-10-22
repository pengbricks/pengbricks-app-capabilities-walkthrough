# Databricks notebook source
# MAGIC %md
# MAGIC # Workspaces and catalogs across dev, test, stage, and prod
# MAGIC
# MAGIC This guide shows how the four environments map to workspaces and Unity Catalog catalogs, and audits one catalog against that layout. The bundle deploys four targets (`dev`, `test`, `stage`, `prod`) into the one workspace in your profile. Each target gets its own schema in a single catalog, which is layout (c) in the guide: the weakest of the three, and the only one a single workspace can show. The four-workspace, four-catalog setup is in `setup/` as SQL and CLI commands that this job does not run.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_seed_environment` | Tags the environment schema, loads 50 sample orders in every environment except prod, and prints the three-level name a table gets in each layout. |
# MAGIC | `02_audit_layout` | Reads the catalog's isolation mode, workspace bindings, owner, and storage, plus the schema's tag and grants. Writes pass, warn, and info findings to `environment_layout_audit`. |
# MAGIC | `03_audit_summary.sql` | SQL task on a warehouse: counts the findings by status and lists the ones that need attention. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-environments` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | The catalog that holds the environment schemas. |
# MAGIC | `schema` | This target's environment schema. In `dev` it is `dev_<you>_envdemo`, your personal sandbox. |
# MAGIC | `environment` | `dev`, `test`, `stage`, or `prod`. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: this notebook only reads and links the deployed job.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run this once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **Read access to the catalog's bindings.** `02_audit_layout` reads the catalog's isolation mode, workspace bindings, and grants. The bindings API allows a metastore admin or the owner of the catalog. Without access the audit records bindings and grants as `info` and still finishes. To get the full findings, make the identity the catalog owner:
# MAGIC    ```bash
# MAGIC    databricks catalogs update <catalog> --owner <principal>
# MAGIC    ```
# MAGIC 2. **The four-workspace layout is not run by the bundle.** `databricks bundle run capability_guides_environments` needs nothing from `setup/`. The files in `setup/` build the catalog-per-environment layout and are commands you run yourself, as a metastore admin, after substituting the placeholders. Run them in this order:
# MAGIC    1. Section 1 of `setup/02_credentials_and_bindings.sh`: one storage credential per environment (the script shows the AWS form; Azure and GCP use a managed identity or a Google service account in the same JSON slot).
# MAGIC    2. `setup/01_catalogs.sql`: external locations, catalogs, and domain schemas. Run it on a SQL warehouse.
# MAGIC    3. Sections 2 to 5 of `setup/02_credentials_and_bindings.sh`: isolate each catalog and bind it to its workspace.
# MAGIC    4. `setup/03_grants.sql`: grants to groups, and ownership to the environment's service principal.
# MAGIC
# MAGIC    The script reads `PROFILE`, `ACCOUNT_ID`, `DEV_WS`, `TEST_WS`, `STAGE_WS`, and `PROD_WS` from the environment. To deploy your own bundle against that layout, start from `setup/databricks.four-workspaces.yml.example` and fill in the hosts, catalogs, and service principals.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_environments"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'environment'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
