# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Create the sample data
# MAGIC
# MAGIC Writes the same sample tables into the dev-like and the prod-like schema. Tables are overwritten, so a rerun keeps the row counts.

# MAGIC
# MAGIC Safe to rerun: both sample tables are regenerated from a fixed seed and replaced in each schema.
# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_access", ['catalog', 'schema', 'use_case', 'reader_group', 'app_service_principal', 'dev_schema', 'prod_schema'])

# COMMAND ----------

import datetime as dt
from types import SimpleNamespace
from common import run_sql_rows, workspace_id, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import grant_sql, principal_kind, qualified

args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    use_case_file=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
    reader_group=params["reader_group"],
    app_service_principal=params["app_service_principal"],
    dev_schema=params["dev_schema"],
    prod_schema=params["prod_schema"],
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

def env_schemas(args) -> dict[str, str]:
    return {"dev": args.dev_schema, "prod": args.prod_schema}

def create_data(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    for env, schema in env_schemas(args).items():
        for table, rows in spec["access"]["rows_per_table"].items():
            count = write_table(spark, spec, args.catalog, schema, table, rows)
            print(f"{env}: {schema}.{table} = {count} rows")

# COMMAND ----------

create_data(args, spark)
