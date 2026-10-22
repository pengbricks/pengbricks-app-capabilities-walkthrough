# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Create the source
# MAGIC
# MAGIC Safe to rerun: the DDL drops and recreates both source tables, then loads the same rows.
# MAGIC
# MAGIC Builds the stand-in source in Lakebase Postgres: `orders` and `customers` in the `dv_source` schema. A few orders break the pipeline rules on purpose (a negative amount, a missing customer, an unknown status). The DDL drops and recreates both tables, so a rerun reloads the same rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_data_validation", ['catalog', 'schema', 'use_case', 'lakebase_project'])
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

from datetime import date, timezone, datetime
from databricks.sdk import WorkspaceClient
from psycopg2.extras import execute_values
import dv_lib

spec = dv_lib.load_spec(SPEC_FILE)
cfg = {**spec["source"], **({"lakebase_project": params["lakebase_project"]} if params["lakebase_project"] else {})}
w = WorkspaceClient()
dv_lib.require_lakebase_project(w, cfg["lakebase_project"])  # stops here, with the create command, if the project is missing
settings = dv_lib.connection_settings(w, cfg)
today = datetime.now(timezone.utc).date()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the tables and load the rows

# COMMAND ----------

schema = dv_lib.ident(cfg["schema"])
with dv_lib.connect(settings) as conn, conn.cursor() as cur:
    cur.execute(dv_lib.SOURCE_DDL.format(schema=schema))
    execute_values(cur, f"INSERT INTO {schema}.customers (customer_id, name, segment) VALUES %s", dv_lib.customer_rows(spec))
    execute_values(cur, f"INSERT INTO {schema}.orders (order_id, customer_id, order_date, status, amount) VALUES %s", dv_lib.order_rows(spec, today))
    cur.execute(f"SELECT (SELECT count(*) FROM {schema}.customers), (SELECT count(*) FROM {schema}.orders)")
    print(f"Source loaded in {cfg['lakebase_project']}/{cfg['lakebase_branch']}: customers, orders = {cur.fetchone()}")
