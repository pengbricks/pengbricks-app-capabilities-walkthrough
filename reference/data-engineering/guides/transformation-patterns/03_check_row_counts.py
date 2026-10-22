# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Check the row counts
# MAGIC
# MAGIC Safe to rerun: the views are only read; `tp_view_counts` is a run log, so it is the one table that gains rows. Counts the rows in every pattern view and compares each count with an independent query on the sources. The results go to `tp_view_counts`, a run log that gains one run's rows per run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_transformations", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
scope = f"{catalog}.{schema}"
ROOT = bundle_root()
USE_CASE_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## What each view should contain
# MAGIC
# MAGIC The expected count comes from a query that does not use the pipeline.

# COMMAND ----------

from datetime import datetime, timezone

# view -> (pattern, SQL that computes the expected row count from the source tables or its upstream view)
CHECKS = [
    ("tp_lookup_enrichment", "lookup enrichment", "SELECT count(*) FROM {s}.de_customers"),
    ("tp_join_inner", "inner join",
     "SELECT count(*) FROM {s}.de_orders o JOIN {s}.de_customers c ON o.customer_id = c.customer_id"),
    ("tp_join_left", "left join", "SELECT count(*) FROM {s}.de_orders"),
    ("tp_join_full", "full join",
     "SELECT (SELECT count(*) FROM {s}.de_orders) + (SELECT count(*) FROM {s}.de_customers c "
     "WHERE NOT EXISTS (SELECT 1 FROM {s}.de_orders o WHERE o.customer_id = c.customer_id))"),
    ("tp_string_functions", "string functions", "SELECT count(*) FROM {s}.de_customers"),
    ("tp_null_conditional", "null detection and conditional logic", "SELECT count(*) FROM {s}.de_customers"),
    ("tp_date_time", "date and time handling", "SELECT count(*) FROM {s}.de_orders"),
    ("tp_cast_valid", "casting, valid rows",
     "SELECT count(*) FROM {s}.de_orders WHERE try_cast(amount_raw AS DECIMAL(12,2)) IS NOT NULL "
     "AND try_cast(quantity_raw AS INT) IS NOT NULL"),
    ("tp_cast_rejects", "casting, reject table",
     "SELECT count(*) FROM {s}.de_orders WHERE try_cast(amount_raw AS DECIMAL(12,2)) IS NULL "
     "OR try_cast(quantity_raw AS INT) IS NULL"),
    ("tp_running_totals", "aggregation with running totals",
     "SELECT count(*) FROM (SELECT DISTINCT category, order_date FROM {s}.tp_cast_valid)"),
    ("tp_pivot", "pivot", "SELECT count(DISTINCT category) FROM {s}.tp_cast_valid"),
    ("tp_unpivot", "unpivot", "SELECT 3 * count(DISTINCT category) FROM {s}.tp_cast_valid"),
    ("tp_last_record", "last record per group", "SELECT count(DISTINCT customer_id) FROM {s}.tp_cast_valid"),
    ("tp_group_iteration", "per-group iteration", "SELECT count(DISTINCT customer_id) FROM {s}.tp_cast_valid"),
]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Compare actual with expected

# COMMAND ----------

run_ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
rows, failures = [], []
for view, pattern, expected_sql in CHECKS:
    actual = spark.sql(f"SELECT count(*) FROM {scope}.{view}").first()[0]
    expected = spark.sql(expected_sql.format(s=scope)).first()[0]
    passed = actual == expected and actual > 0
    rows.append((run_ts, view, pattern, int(actual), int(expected), passed))
    print(f"{'ok  ' if passed else 'FAIL'} {view:<22} rows={actual:<7} expected={expected}")
    if not passed:
        failures.append(view)

# One more check: valid + rejected rows account for every order.
total = spark.sql(f"SELECT count(*) FROM {scope}.de_orders").first()[0]
valid = next(r[3] for r in rows if r[1] == "tp_cast_valid")
rejected = next(r[3] for r in rows if r[1] == "tp_cast_rejects")
print(f"casting split: {valid} valid + {rejected} rejected = {valid + rejected} of {total} orders")
if valid + rejected != total:
    failures.append("cast_split")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results and fail on any mismatch

# COMMAND ----------

spark.createDataFrame(
    rows, "run_ts string, view_name string, pattern string, row_count long, expected_count long, passed boolean"
).write.mode("append").saveAsTable(f"{scope}.tp_view_counts")
if failures:
    raise Exception(f"Row count checks failed: {failures}")
