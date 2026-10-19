# Databricks notebook source
# MAGIC %md
# MAGIC # Configuration-driven ingestion
# MAGIC
# MAGIC Two providers send the same kind of record in different shapes. Provider-specific logic lives in one adapter file, and everything else runs through one shared framework: reading, mapping, validation, quarantine, upsert, audit, and error handling. Adding a feed is configuration, not code.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_land_files` | Generates deterministic sample files for every feed with the sample-data generator and creates the framework tables. |
# MAGIC | `02_ingest_feeds` | Runs the shared framework once per feed: read, map, validate, quarantine, merge, audit. In the job this is a `for_each` task. |
# MAGIC | `03_compare_feeds` | Compares the feeds from one run in the audit table and fails if any feed did not succeed. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the **Ingestion framework job** (or press **Quick run** on the guide page in the app). To work step by step, open any notebook below and press Run all. Blank widgets take the deployed job's defaults, and typing a value into a widget overrides it for one run. Run the notebooks in order the first time.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for this guide's tables and the `landing` volume. |
# MAGIC | `use_case` | Use-case spec under `use_cases/` that defines the feeds, rules, and sample data. |

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
from capability_framework.workspace import guide_links_html

params = load_params(dbutils, "capability_guides_ingestion_framework", ["catalog", "schema", "use_case"])

w = WorkspaceClient()
displayHTML(guide_links_html(w, ["capability_guides_ingestion_framework"], []))
