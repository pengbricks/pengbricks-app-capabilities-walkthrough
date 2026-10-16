# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Compare with the source
# MAGIC
# MAGIC Compares each landed table with the same query run at the source: row count, checksum and column types. The checksum is the sum of the first 8 hex digits of `md5` over a canonical row string, computed in Postgres SQL on one side and Spark SQL on the other.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_relational_extract", ['catalog', 'schema', 'use_case', 'lakebase_project', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from source_ingestion import lakebase
from source_ingestion.checksum import postgres_checksum_sql, spark_checksum_sql
from source_ingestion.relational_sql import CUSTOM_QUERY, CUSTOMER_COLUMNS, ORDER_COLUMNS, REVENUE_COLUMNS, SCHEMA
from source_ingestion.spec import load_spec

cfg = load_spec(SPEC_FILE)["relational"]
if params["lakebase_project"]:
    cfg = {**cfg, "lakebase_project": params["lakebase_project"]}
settings = lakebase.connection_settings(
    WorkspaceClient(), cfg["lakebase_project"], cfg["lakebase_branch"], cfg["lakebase_endpoint"], cfg["lakebase_database"]
)

comparisons = [
    ("rel_customers", f"SELECT * FROM {SCHEMA}.customers", CUSTOMER_COLUMNS, {"credit_limit": "decimal(12,2)", "created_date": "date", "customer_id": "int"}),
    ("rel_orders", f"SELECT * FROM {SCHEMA}.orders", ORDER_COLUMNS, {"amount": "decimal(12,2)", "order_date": "date", "discount_pct": "int"}),
    ("rel_customer_revenue", CUSTOM_QUERY, REVENUE_COLUMNS, {"net_revenue": "decimal(14,2)", "country_rank": "int"}),
]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run both sides and compare

# COMMAND ----------

results = []
with lakebase.connect(settings) as conn, conn.cursor() as cur:
    for table, source_sql, columns, expected_types in comparisons:
        cur.execute(postgres_checksum_sql(columns, source_sql))
        source_rows, source_sum = cur.fetchone()
        landed = spark.sql(spark_checksum_sql(columns, f"{ns}.{table}")).first()
        types = {r["col_name"]: r["data_type"] for r in spark.sql(f"DESCRIBE TABLE {ns}.{table}").collect()}
        types_ok = all(types.get(c) == t for c, t in expected_types.items())
        passed = int(source_rows) == int(landed["row_count"]) and int(source_sum) == int(landed["checksum"]) and types_ok
        results.append((params["run_id"], datetime.now(timezone.utc), table, int(source_rows), int(landed["row_count"]),
                        int(source_sum), int(landed["checksum"]), types_ok, passed))
        print(f"{'PASS' if passed else 'FAIL'} {table}: source {source_rows} rows / {source_sum}, landed {landed['row_count']} rows / {landed['checksum']}, types ok={types_ok}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results and fail on any mismatch

# COMMAND ----------

spark.createDataFrame(
    results,
    "run_id string, checked_at timestamp, table_name string, source_rows bigint, landed_rows bigint, "
    "source_checksum bigint, landed_checksum bigint, types_match boolean, passed boolean",
).write.mode("append").saveAsTable(f"{ns}.relational_extract_checks")
if not all(r[-1] for r in results):
    raise SystemExit("Landed tables do not match the source")
