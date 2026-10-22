# Databricks notebook source
# MAGIC %md
# MAGIC # Genie Code: from sample data to notebooks and dashboards
# MAGIC
# MAGIC The story: a governed sample dataset, a Lakeflow Designer flow, a Genie Code notebook, a Genie Code dashboard, then a check.
# MAGIC
# MAGIC ## Required setup
# MAGIC
# MAGIC | Need | Where |
# MAGIC |---|---|
# MAGIC | Genie Code available in the workspace | Genie Code runs in notebooks, the SQL editor, Lakeflow Pipelines Editor and dashboards |
# MAGIC | Partner-powered AI features on | Genie Code's agentic capabilities need the setting on at the account and workspace level (a workspace admin or account admin sets it) |
# MAGIC | Lakeflow Designer access | The **Visual data prep** entry under **New** |
# MAGIC | A serverless SQL warehouse | Dashboards run their datasets on it |
# MAGIC | Unity Catalog privileges | `USE CATALOG`, `USE SCHEMA`, `SELECT` and `CREATE TABLE` on the schema; Genie Code runs as you |
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_preflight_sample_data` | Writes `gc_customers`, `gc_products` and `gc_orders` with a fixed seed and prints row counts. |
# MAGIC | `02_check_outputs` | Checks the gold tables, reconciles revenue, lists `gc_` notebooks and dashboards, and reports what is missing. |
# MAGIC | `03_install_skills` | Standalone, not in the job. Copies the example skill `skills/gc-sample-data/` to your own Genie Code skills folder, and optionally `instructions.md` to your user instructions file. Writing to the shared workspace folder is off unless you ask for it. |
# MAGIC
# MAGIC Between the two, you do Steps 1 to 3 below by hand. The job `capability-guides-genie-code` runs 01 then 02. Run it once before the interactive steps (02 will report what is missing) and again after.
# MAGIC
# MAGIC Safe to rerun: the sample tables use `CREATE OR REPLACE`, and the check only reads.
# MAGIC
# MAGIC The prompts below are the same text as `prompts.md`, which is the copy to keep in Git.

# COMMAND ----------

# MAGIC %md
# MAGIC Replace `<catalog>` and `<schema>` with the values the preflight printed. Every prompt names its tables, states the grain, and asks for a test. Paste one prompt at a time, read the plan and the diff, then run it.
# MAGIC
# MAGIC Keep this file in Git. When a prompt changes, change it here first and note what the change fixed.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 1. Lakeflow Designer (visual data prep)
# MAGIC
# MAGIC Click the plus icon (**New**), choose **Visual data prep**, and describe each step in the canvas prompt, which opens Genie Code. Save the file as `gc_orders_flow`. The Output operator has Overwrite, Append and Merge write modes; the prompts ask for Overwrite.
# MAGIC
# MAGIC ### 1.1 Silver
# MAGIC
# MAGIC ```text
# MAGIC Sources: <catalog>.<schema>.gc_orders, gc_customers and gc_products.
# MAGIC Keep orders whose status is completed or shipped.
# MAGIC Join gc_customers on customer_id and gc_products on product_id (inner joins).
# MAGIC Add order_total = quantity * unit_price, and order_month = the first day of the month of order_ts.
# MAGIC Remove duplicate rows by order_id with a Unique operator.
# MAGIC Write the result to the table <catalog>.<schema>.gc_orders_silver, overwrite mode.
# MAGIC ```
# MAGIC
# MAGIC Check after it runs:
# MAGIC
# MAGIC - Row count equals `SELECT COUNT(*) FROM gc_orders WHERE status IN ('completed','shipped')`.
# MAGIC - `COUNT(*) = COUNT(DISTINCT order_id)` on `gc_orders_silver`.
# MAGIC - `region`, `segment` and `category` have no nulls.
# MAGIC
# MAGIC ### 1.2 Gold: sales by region and month
# MAGIC
# MAGIC ```text
# MAGIC After the gc_orders_silver output, add an Aggregate.
# MAGIC Group by order_month, region and category.
# MAGIC Compute orders = count of order_id, units = sum of quantity, revenue = sum of order_total.
# MAGIC The grain is one row per order_month, region and category.
# MAGIC Write the result to <catalog>.<schema>.gc_sales_by_region_month, overwrite mode.
# MAGIC ```
# MAGIC
# MAGIC Check: `SUM(revenue)` equals `SUM(order_total)` on silver. No (order_month, region, category) key appears twice.
# MAGIC
# MAGIC ### 1.3 Gold: customer value
# MAGIC
# MAGIC ```text
# MAGIC Add a second branch from gc_orders_silver.
# MAGIC Group by customer_id, region and segment.
# MAGIC Compute orders = count of order_id, revenue = sum of order_total,
# MAGIC first_order_date = min of order_ts cast to date, last_order_date = max of order_ts cast to date.
# MAGIC The grain is one row per customer_id.
# MAGIC Write the result to <catalog>.<schema>.gc_customer_value, overwrite mode.
# MAGIC ```
# MAGIC
# MAGIC Check: one row per `customer_id`, and `SUM(revenue)` equals the silver total.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 2. Genie Code in a notebook
# MAGIC
# MAGIC Create a notebook named `gc_orders_analysis`, attach serverless compute, open Genie Code and use agent mode.
# MAGIC
# MAGIC ### 2.1 Profile
# MAGIC
# MAGIC ```text
# MAGIC In a new cell, profile <catalog>.<schema>.gc_orders_silver.
# MAGIC Show the row count, the null count per column, the min and max of order_ts,
# MAGIC the number of distinct customer_id values, and revenue by status.
# MAGIC Only read the table. Do not write any table.
# MAGIC Add an assert that the row count equals the distinct order_id count.
# MAGIC ```
# MAGIC
# MAGIC ### 2.2 Transformation
# MAGIC
# MAGIC ```text
# MAGIC Read <catalog>.<schema>.gc_customer_value.
# MAGIC Add spend_tier with percent_rank over revenue: top 10 percent is high, the next 40 percent is mid, the rest is low.
# MAGIC The grain stays one row per customer_id.
# MAGIC Display the count of customers and the revenue per tier.
# MAGIC Add an assert that the tier counts add up to the row count of gc_customer_value.
# MAGIC Do not write a table.
# MAGIC ```
# MAGIC
# MAGIC ### 2.3 Chart
# MAGIC
# MAGIC ```text
# MAGIC Read <catalog>.<schema>.gc_sales_by_region_month.
# MAGIC Draw a line chart of revenue by order_month with one line per region, sorted by month, with titles and axis labels.
# MAGIC Add an assert that the sum of the plotted values equals SUM(revenue) in the table.
# MAGIC ```
# MAGIC
# MAGIC Check after each prompt: read the diff, confirm the table names match, run the cell, and confirm the assert passes.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 3. Genie Code for an AI/BI dashboard
# MAGIC
# MAGIC Create a dashboard named `gc_sales_dashboard`, open Genie Code in the dashboard and ask for a draft.
# MAGIC
# MAGIC ### 3.1 Draft
# MAGIC
# MAGIC ```text
# MAGIC In this dashboard, named gc_sales_dashboard, use <catalog>.<schema>.gc_sales_by_region_month and <catalog>.<schema>.gc_customer_value.
# MAGIC Use one dataset per table and no joins. Select only the columns each visual needs.
# MAGIC Page Overview:
# MAGIC - a counter for total revenue
# MAGIC - a line chart of revenue by order_month, split by region
# MAGIC - a bar chart of revenue by category
# MAGIC - a table of the top 10 customers by revenue, with segment and region
# MAGIC Add a filter on region that applies to the first three visuals.
# MAGIC ```
# MAGIC
# MAGIC ### 3.2 Fix-ups
# MAGIC
# MAGIC ```text
# MAGIC Format revenue as currency with no decimals, sort the bar chart from highest to lowest,
# MAGIC and rename the visuals so each title says what it measures.
# MAGIC ```
# MAGIC
# MAGIC Check: the counter equals `SUM(revenue)` on `gc_sales_by_region_month`. The Data tab shows only the two gold tables. Picking one region changes all three filtered visuals.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 4. Check
# MAGIC
# MAGIC Run `02_check_outputs`. It reports what exists, what reconciles, and what is missing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params, JOB_TAG
JOB_KEY = "capability_guides_genie_code"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
