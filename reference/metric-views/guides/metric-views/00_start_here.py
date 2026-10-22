# Databricks notebook source
# MAGIC %md
# MAGIC # Metric views
# MAGIC
# MAGIC This guide defines business metrics once, in Unity Catalog metric views, and proves the numbers are right. It generates small synthetic orders, customers, products, and sessions tables, deploys two metric views from SQL files kept in the repo, queries them with `MEASURE()`, and compares every measure with a hand-written aggregate over the same tables. The last step reads lineage, grants, and the certification tag.
# MAGIC
# MAGIC The two views cover the usual first metrics. `mv_orders_metrics` has order count, net revenue, active customers (a distinct count), average order value (a ratio), and window measures for month-over-month growth, a rolling three months, and a running total. `mv_funnel_metrics` has sessions and conversion rate.
# MAGIC
# MAGIC All data is generated in `src/mv_lib.py` with fixed seeds, so every run writes the same rows. Nothing is real.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | File | What it does |
# MAGIC |---|---|
# MAGIC | `01_generate_data` | Writes `mv_customers`, `mv_products`, `mv_orders`, and `mv_sessions`. |
# MAGIC | `02_orders_metric_view.sql` | The orders metric view: joins, filter, measures, window measures, and agent metadata. A job SQL task on the warehouse runs it. |
# MAGIC | `03_funnel_metric_view.sql` | The sessions metric view with the conversion-rate ratio. Also a SQL task, in parallel with 02. |
# MAGIC | `04_verify_measures` | Queries each measure with `MEASURE()` at several groupings, compares it with hand-written SQL, and shows three pitfalls. |
# MAGIC | `05_lineage_and_governance` | Reads the object type, owner, grants, certification tag, and upstream lineage. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC **By hand, in this folder:** Run all in `01_generate_data`. Open each `.sql` file, attach a SQL warehouse, fill in the `catalog` and `schema` parameter boxes, and run it. Then Run all in `04` and `05`. The Python notebooks fill their widgets from the deployed job.
# MAGIC
# MAGIC **As a job:** run `capability-guides-metric-views` (or **Quick run** in the app).
# MAGIC
# MAGIC **Safe to rerun, in any mix.** Tables are replaced, `CREATE OR REPLACE VIEW` swaps the definition in place, and each step swaps its own rows in `mv_results`.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the schema and the metric views. |
# MAGIC | `schema` | Schema for the sample tables, the metric views, and `mv_results`. |
# MAGIC | `warehouse_id` | Bundle variable: the SQL warehouse that runs the two SQL tasks. |
# MAGIC | `run_id` | Set by the job on steps 4 and 5. Defaults to `manual` when run by hand. |

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC - **Run `01_generate_data` first.** It writes the four sample tables the views read.
# MAGIC - **Create the two metric views on a SQL warehouse.** `02_orders_metric_view.sql` and `03_funnel_metric_view.sql` are plain SQL files that the job runs as SQL tasks. Opened as notebooks they never run on their own, so `mv_orders_metrics` and `mv_funnel_metrics` do not exist, and `04` and `05` would fail with `TABLE_OR_VIEW_NOT_FOUND`. Run 02, then 03, either way:
# MAGIC   - In the SQL editor or a notebook: attach a SQL warehouse, type your catalog and schema into the `catalog` and `schema` parameter boxes, and run each file in order.
# MAGIC   - Or run the whole job: `databricks bundle run capability_guides_metric_views --target dev --var catalog=<catalog> --var warehouse_id=<warehouse-id> --var app_service_principal=<app-service-principal-application-id>`.
# MAGIC - **Privileges** for the running user: `USE CATALOG` and `USE SCHEMA` on the schema, `SELECT` on the four tables, and `CREATE TABLE` on the schema (that covers creating a metric view). `GRANT USE CATALOG ON CATALOG <catalog> TO <principal>; GRANT USE SCHEMA, SELECT, CREATE TABLE ON SCHEMA <catalog>.<schema> TO <principal>;`

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_metric_views", ['catalog', 'schema'])
print(params)
