# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Generate the sample data
# MAGIC
# MAGIC Generates the customers and orders tables from the spec. It drops each table first, because a table that carries a mask or row filter cannot be overwritten in place.

# MAGIC
# MAGIC Safe to rerun: each table is dropped with `IF EXISTS` and rebuilt from a fixed seed, which also clears any mask or filter left on it.
# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_row_column_security", ['catalog', 'schema', 'use_case', 'app_service_principal'])

# COMMAND ----------

import datetime as dt
from types import SimpleNamespace
from common import run_sql_rows, workspace_id, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import grant_sql, principal_kind, qualified
from governance_lib.sqlgen import attribute_filter_body, attribute_filter_sql, dynamic_filter_body, dynamic_filter_sql, mask_body, mask_function_sql

args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    use_case_file=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
    app_service_principal=params["app_service_principal"],
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

def shared_table(spec, table: str) -> str:
    """Physical name in the shared schema: the spec's logical table name plus the bundle prefix."""
    return f"{spec.get('shared_table_prefix', '')}{table}"

def generate_data(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    for table in spec["tables"]:
        # Drop first: a table that already carries a mask or filter cannot be overwritten in place.
        target = shared_table(spec, table)
        spark.sql(f"DROP TABLE IF EXISTS {qualified(args.catalog, args.schema, target)}")
        print(f"{target}: {write_table(spark, spec, args.catalog, args.schema, table, target=target)} rows")

# COMMAND ----------

admin = load_spec(args.use_case_file)["policy"]["admin_group"]
if not spark.sql(f"SELECT is_member('{admin}')").first()[0]:
    raise RuntimeError(f"The job identity is not in the {admin} group, so 03_test_policies cannot read unmasked rows. Run: databricks groups list --filter 'displayName eq {admin}' for the group ID, then databricks groups patch <group-id> --json @add_member.json (see Required setup). Nothing was changed.")
generate_data(args, spark)
