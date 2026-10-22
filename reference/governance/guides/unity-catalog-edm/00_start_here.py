# Databricks notebook source
# MAGIC %md
# MAGIC # Unity Catalog with an enterprise data management program
# MAGIC
# MAGIC This guide builds the Unity Catalog side of an EDM integration on three sample tables: tags as the contract between the EDM tool and the platform, an ABAC policy that acts on those tags, the metadata feed a scanner reads, external lineage for systems Databricks does not run, and a certification tag.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_create_sample_tables` | Creates `edm_customers` (with sensitive columns), `edm_orders`, and a gold table, with comments. |
# MAGIC | `02_apply_tags` | Creates governed tags and applies them. Falls back to plain tags and says so if the job identity cannot create governed tags. |
# MAGIC | `03_abac_policy` | Creates a tag-driven ABAC mask and row filter with `CREATE POLICY`, then queries as the job identity. |
# MAGIC | `04_metadata_feed` | Builds `edm_metadata_feed_*` tables from `information_schema` and the lineage system tables, and prints the scanner's `GRANT` statements. |
# MAGIC | `05_external_lineage` | Registers a PostgreSQL source and a BI report as external lineage, then reads it back. |
# MAGIC | `06_certify_gold` | Sets `system.certification_status = certified` on the gold table, if permitted. |
# MAGIC | `07_cleanup` | Drops the `edm_` policies and external metadata. Gated by the `cleanup` parameter, default `keep`. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-unity-catalog-edm` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for this guide's tables. |
# MAGIC | `scanner_principal` | Name used in the printed scanner `GRANT` statements. Nothing is granted. |
# MAGIC | `tag_mode` | `governed` (default) creates account-level governed tags and uses ABAC. `plain` creates nothing at the account level and uses a mask and row filter. |
# MAGIC | `cleanup` | `keep` (default) or `drop`. `drop` removes the `edm_` policies and external metadata in `07`. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: it only reads the deployed job and links to it.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_unity_catalog_edm"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'scanner_principal', 'cleanup', 'tag_mode'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
