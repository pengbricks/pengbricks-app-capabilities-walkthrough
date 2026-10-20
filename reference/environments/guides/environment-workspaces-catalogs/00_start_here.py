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
