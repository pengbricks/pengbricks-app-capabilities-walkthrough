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

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. The identity that runs the job is the person or service principal behind `databricks bundle run`. It is written `<principal>` below. A metastore admin or account admin runs most of them.
# MAGIC
# MAGIC If you lack account-level rights, skip items 1 and 2 and run with `tag_mode=plain` (item 6). It creates nothing at the account level. Items 3 to 5 apply in both modes.
# MAGIC
# MAGIC 1. **Governed tags (`tag_mode=governed`, the default).** Governed tags are account-level tag policies. The job identity needs permission to create tag policies, or an admin creates them first:
# MAGIC    ```bash
# MAGIC    databricks tag-policies create-tag-policy edm_pii --json '{"description": "Kind of personal identifier a column holds",
# MAGIC      "values": [{"name": "id_number"}, {"name": "contact"}]}'
# MAGIC    databricks tag-policies create-tag-policy edm_region --json '{"description": "Column holds the data region used for row filtering"}'
# MAGIC    ```
# MAGIC    Then give `<principal>` the ASSIGN permission on `edm_pii` and `edm_region`: Catalog Explorer, **Governed tags**, the tag, **Permissions**. There is no SQL `GRANT` for it. Without it `02_apply_tags` falls back to plain tags.
# MAGIC 2. **ABAC policies.** `03_abac_policy` needs serverless compute or Databricks Runtime 16.4 or above. The job already runs serverless. For a manual run, attach serverless compute.
# MAGIC 3. **External metadata.** `05_external_lineage` needs `CREATE EXTERNAL METADATA` on the metastore. Without it the step records `SKIPPED`:
# MAGIC    ```sql
# MAGIC    GRANT CREATE EXTERNAL METADATA ON METASTORE TO `<principal>`;
# MAGIC    ```
# MAGIC 4. **Certification.** `06_certify_gold` needs ASSIGN on the system tag `system.certification_status` (Catalog Explorer, **Governed tags**, `system.certification_status`, **Permissions**) and APPLY TAG on the table:
# MAGIC    ```sql
# MAGIC    GRANT APPLY TAG ON TABLE <catalog>.<schema>.edm_customer_revenue_gold TO `<principal>`;
# MAGIC    ```
# MAGIC    Without them the step records `not permitted`.
# MAGIC 5. **Lineage feed.** `04_metadata_feed` reads `system.access`. A metastore admin enables the schema if it is off, then grants read access:
# MAGIC    ```bash
# MAGIC    databricks system-schemas enable <metastore-id> access   # get the ID from: databricks metastores current
# MAGIC    ```
# MAGIC    ```sql
# MAGIC    GRANT USE CATALOG ON CATALOG system TO `<principal>`;
# MAGIC    GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.access.table_lineage TO `<principal>`;
# MAGIC    GRANT SELECT ON TABLE system.access.column_lineage TO `<principal>`;
# MAGIC    ```
# MAGIC    Without them the lineage feed tables are skipped. Lineage appears a few minutes after a query, so the first run can be empty.
# MAGIC 6. **No account rights: use plain tags.** Run the job with `tag_mode=plain`. It applies plain tags and a column mask and row filter, and skips items 1 and 2:
# MAGIC    ```bash
# MAGIC    databricks bundle run capability_guides_unity_catalog_edm --target dev --params tag_mode=plain
# MAGIC    ```

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
