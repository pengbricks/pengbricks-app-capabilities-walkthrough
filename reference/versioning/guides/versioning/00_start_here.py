# Databricks notebook source
# MAGIC %md
# MAGIC # Versioning data contracts
# MAGIC
# MAGIC This guide publishes three versions of a `customers` data contract. A nonbreaking change (v1.1.0) evolves the table in place. A breaking change (v2.0.0) ships as a new table, and the old name becomes a deprecated compatibility view. A gate rejects any change whose version bump is wrong, a registry records every version, and a notification row tells each consumer what to change.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes deterministic sample rows for the dataset named in the use-case spec (dbldatagen). |
# MAGIC | `02_compatibility_gate` | Checks every consecutive pair of contracts, then proves the gate rejects a breaking change labeled as a minor release. |
# MAGIC | `03_apply_v1` | Creates the table at v1.0.0 and evolves it in place to v1.1.0. Drops its own earlier output first, so reruns are clean. |
# MAGIC | `04_apply_v2` | Publishes v2.0.0 as a new table, keeps `customers_v1` alive as a deprecated view, and archives the old table. |
# MAGIC | `05_show_traceability` | Shows the registry, Delta history, Unity Catalog tags, and checks the view still has the v1.1.0 shape. |
# MAGIC | `06_notify_consumers` | Writes one notification row per consumer, with the columns it must change and the deadline. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-versioning-release` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each. Every notebook installs `requirements.txt` and reads its variables from widgets.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the seed table, the customers tables and view, the registry and the notifications. |
# MAGIC | `use_case` | Spec under `use_cases/` that names the dataset, owner, consumers and seed. |
# MAGIC | `release` | Release identifier (a Git tag or commit SHA) recorded in tags and the registry. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_versioning_release"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'release'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
