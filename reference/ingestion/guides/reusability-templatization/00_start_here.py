# Databricks notebook source
# MAGIC %md
# MAGIC # Reusable ingestion templates
# MAGIC
# MAGIC The second feed, provider B, was onboarded without new code: it is a block in the use-case spec, and a renderer turns that block into a feed config. This guide shares its job and notebooks with *Configuration-driven ingestion*, so it has no notebooks of its own.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `../configuration-vs-code/01_land_files` | Generates sample files for every feed in the use-case spec. |
# MAGIC | `../configuration-vs-code/02_ingest_feeds` | Runs the shared framework for each feed, provider A and provider B alike. |
# MAGIC | `../configuration-vs-code/03_compare_feeds` | Compares both feeds from one run in the audit table. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the **Ingestion framework job** (or press **Quick run** on the guide page in the app). To work step by step, open any notebook below and press Run all. Blank widgets take the deployed job's defaults, and typing a value into a widget overrides it for one run. Run the notebooks in order the first time. The files to read are `use_cases/general.yml`, `feeds/general/provider_b.yml`, and `tools/render_use_case.py`.
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
