# Databricks notebook source
# MAGIC %md
# MAGIC # IDE developer experience: tested transforms on Databricks
# MAGIC
# MAGIC This guide shows a workflow you can develop in an IDE and run on Databricks. Transformations live in a small Python package, `dx_demo`, as pure DataFrame functions with unit tests. The job runs the same pytest suite on serverless, builds a Delta table from a use-case spec, and checks the output with SQL assertions.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_unit_tests` | Runs the pytest suite in `tests/` on serverless and fails on any test failure. |
# MAGIC | `02_transform` | Generates sample data from the spec, applies `dx_demo`, and writes the output table. |
# MAGIC | `03_sql_checks` | Asserts the output table is non-empty, has unique and non-null keys, and has no negative values. |
# MAGIC | `04_explore` | Interactive only (not a job task): import the package, run a transform, and step through it with the notebook debugger. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-developer-experience-workflow` (or **Quick run** in the app). To run by hand, open `01_unit_tests`, `02_transform` and `03_sql_checks` in order and use Run all in each. `04_explore` runs on its own.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog for the output table. |
# MAGIC | `schema` | Schema for the output table. |
# MAGIC | `use_case` | Name of the spec in `use_cases/` that defines the dataset. |
# MAGIC | `output_table` | Must match `output_table` in the spec. `02_transform` fails on a mismatch. |
# MAGIC | `key_column` | Must match `key_column` in the spec. Used by the SQL checks. |
# MAGIC | `value_column` | Must match `value_column` in the spec. Used by the SQL checks. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_developer_experience_workflow"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case', 'output_table', 'key_column', 'value_column'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
