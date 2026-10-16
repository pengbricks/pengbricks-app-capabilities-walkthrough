# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Create the source database
# MAGIC
# MAGIC Creates the source schema, tables and database function in Lakebase Postgres and loads sample rows. The DDL recreates the tables, so a rerun reloads the same rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_relational_extract", ['catalog', 'schema', 'use_case', 'lakebase_project'])
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from psycopg2.extras import execute_values
from source_ingestion import lakebase
from source_ingestion.datagen import entity_frame
from source_ingestion.relational_sql import DDL, SCHEMA
from source_ingestion.spec import load_spec

spec = load_spec(SPEC_FILE)
cfg = spec["relational"]
if params["lakebase_project"]:
    cfg = {**cfg, "lakebase_project": params["lakebase_project"]}
settings = lakebase.connection_settings(
    WorkspaceClient(), cfg["lakebase_project"], cfg["lakebase_branch"], cfg["lakebase_endpoint"], cfg["lakebase_database"]
)

customers = entity_frame(spark, spec, "customers").collect()
orders = entity_frame(spark, spec, "orders").collect()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the tables and load the rows

# COMMAND ----------

with lakebase.connect(settings) as conn, conn.cursor() as cur:
    cur.execute(DDL)
    execute_values(
        cur,
        f"INSERT INTO {SCHEMA}.customers (customer_id, first_name, last_name, email, city, country, segment, created_date, credit_limit) VALUES %s",
        [(r.customer_id, r.first_name, r.last_name, r.email, r.city, r.country, r.segment, r.created_date, r.credit_limit) for r in customers],
    )
    execute_values(
        cur,
        f"INSERT INTO {SCHEMA}.orders (order_id, customer_id, order_date, status, amount, discount_pct, notes) VALUES %s",
        [(r.order_id, r.customer_id, r.order_date, r.status, r.amount, r.discount_pct, r.notes) for r in orders],
    )
    cur.execute(f"SELECT (SELECT count(*) FROM {SCHEMA}.customers), (SELECT count(*) FROM {SCHEMA}.orders)")
    print(f"Source loaded in {cfg['lakebase_project']}/{cfg['lakebase_branch']}: customers, orders = {cur.fetchone()}")
