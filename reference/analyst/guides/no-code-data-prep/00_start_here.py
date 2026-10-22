# Databricks notebook source
# MAGIC %md
# MAGIC # Lakeflow Designer: no-code data preparation
# MAGIC
# MAGIC This guide pairs a Lakeflow Designer flow with its SQL equivalent. The flow filters, joins, renames and derives columns in the UI. The SQL builds the same `prep_flow_output` table, so you can compare the flow's output with a known-good result.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes the governed sample tables from the use-case spec (sample-data generator, fixed seed). |
# MAGIC | `02_build_flow_output` | Builds `prep_flow_output` and `prep_flow_summary` with SQL: the same steps the Designer flow performs. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-no-code-prep` (or **Quick run** in the app). To run by hand, open the two notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables, views and volumes. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the generated data. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.
# MAGIC
# MAGIC ## Build the flow from a prompt
# MAGIC
# MAGIC Click the plus icon (**New**), choose **Visual data prep**, and paste this into the Genie Code prompt above the canvas. Replace `<catalog>` and `<schema>` first. The same text is in `prompts.md`, the copy to keep in Git.
# MAGIC
# MAGIC ```
# MAGIC Sources: <catalog>.<schema>.analyst_orders and <catalog>.<schema>.analyst_customers.
# MAGIC Filter analyst_orders to rows where status is equal to completed and order_ts is on or after 2026-01-01.
# MAGIC Join the filtered orders to analyst_customers on customer_id (inner join).
# MAGIC Add Custom columns: order_date = order_ts cast to a date, order_total = quantity * unit_price cast to decimal(12,2), and order_size = 'large' when quantity * unit_price is 1000 or more, otherwise 'standard'.
# MAGIC Add a Select operator that keeps only these columns, in this order: order_number (renamed from order_id), customer_id, sales_region (renamed from region), customer_segment (renamed from segment), order_date, quantity, unit_price, order_total, order_size.
# MAGIC Write the result to the table <catalog>.<schema>.prep_flow_output_designer, overwrite mode.
# MAGIC ```
# MAGIC
# MAGIC Check the result: `prep_flow_output_designer` must match `prep_flow_summary` in rows, customers and total, and `EXCEPT` against `prep_flow_output` must return no rows.
# MAGIC
# MAGIC Safe to rerun: tables are replaced, so the job and each notebook can run again.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_no_code_prep"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
