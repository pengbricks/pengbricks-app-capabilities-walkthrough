# Databricks notebook source
# MAGIC %md
# MAGIC # SQL and notebook analysis at scale
# MAGIC
# MAGIC This guide analyzes governed order data three ways: SQL, a Python notebook that moves results between pandas and Unity Catalog, and a timed aggregation over 6 million generated rows on serverless compute. An R notebook shows the sparklyr path for classic clusters.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes the governed sample tables from the use-case spec (sample-data generator, fixed seed). |
# MAGIC | `02_sql_exploration` | Three SQL analyses saved as tables: revenue by region and segment, top customers, monthly running total. |
# MAGIC | `03_python_pandas_roundtrip` | Queries with SQL, analyzes in pandas, writes the result back to Unity Catalog. |
# MAGIC | `04_large_aggregation` | Generates 6 million events and times a scan, a group-by and approximate percentiles. |
# MAGIC | `05_r_sparklyr_summary` | R and sparklyr summary. Not a job task: serverless does not run R, so attach it to a classic cluster. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-sql-notebooks` (or **Quick run** in the app). Notebooks 02 to 04 run in parallel after 01. To run by hand, run 01 first, then open any other notebook and use Run all.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, views and volumes. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the generated data. |
# MAGIC | `run_id` | Set by the job on `04_large_aggregation`. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC Safe to rerun: tables are replaced. Only the timing run log, `large_aggregation_timing`, gains rows.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Only `05_r_sparklyr_summary` has setup. Notebooks 01 to 04 run on serverless compute and a SQL warehouse as the job configures them.
# MAGIC
# MAGIC - **A classic all-purpose cluster with R.** Serverless notebooks and jobs allow only SQL and Python, so the R notebook cannot run there, and it cannot detect serverless because R never starts. Use a Databricks Runtime that includes R, in standard or dedicated access mode (sparklyr needs one of the two). Create one with the CLI, using your cloud's node type:
# MAGIC   ```bash
# MAGIC   databricks clusters spark-versions            # pick a current LTS runtime key
# MAGIC   databricks clusters list-node-types           # pick a node type your cloud offers
# MAGIC   databricks clusters create <spark-version> \
# MAGIC     --cluster-name sparklyr-demo --node-type-id <node-type> --num-workers 1 \
# MAGIC     --data-security-mode DATA_SECURITY_MODE_DEDICATED --single-user-name <your-user> \
# MAGIC     --autotermination-minutes 30
# MAGIC   ```
# MAGIC   In the UI: Compute, Create compute, pick a Databricks Runtime, set access mode to Dedicated (or Standard), choose a node type, then Create. Attach `05_r_sparklyr_summary` to it from the notebook's compute picker.
# MAGIC - **Run `01_generate_data` first** (or the job `capability-guides-sql-notebooks`). The R notebook reads `analyst_orders` and `analyst_customers`.
# MAGIC - **Fill the two widgets.** R notebooks do not take job parameters. Type the `catalog` and `schema` the job used into the widgets at the top; if they are blank the notebook stops and tells you.
# MAGIC - **Privileges** for the user running the cluster: `USE CATALOG` and `USE SCHEMA` on the schema, `SELECT` on both tables, and `CREATE TABLE` on the schema, because the notebook writes `r_revenue_by_region`. For example: `GRANT USE CATALOG ON CATALOG <catalog> TO <principal>; GRANT USE SCHEMA, SELECT, CREATE TABLE ON SCHEMA <catalog>.<schema> TO <principal>;`

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_sql_notebooks"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
