# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Policy inventory
# MAGIC
# MAGIC Lists the masks and row filters attached to this guide's tables from `information_schema` and asserts the expected counts.

# MAGIC
# MAGIC Safe to rerun: it only reads `information_schema`, and `policy_inventory` is replaced.
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

def policy_inventory(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    info = f"{qualified(args.catalog)}.information_schema"
    # The schema is shared with other bundles: inventory only this bundle's tables.
    mine = ", ".join("'" + shared_table(spec, t) + "'" for t in spec["tables"])
    masks = run_sql_rows(spark, f"""SELECT table_name, column_name AS target, mask_name AS policy_function
        FROM {info}.column_masks WHERE table_schema = '{args.schema}' AND table_name IN ({mine})""")
    filters = run_sql_rows(spark, f"""SELECT table_name, target_columns AS target, filter_name AS policy_function
        FROM {info}.row_filters WHERE table_schema = '{args.schema}' AND table_name IN ({mine})""")
    rows = [{"policy_type": "column mask", **r} for r in masks] + [{"policy_type": "row filter", **r} for r in filters]
    write_rows(spark, args.catalog, args.schema, "policy_inventory", rows,
               "policy_type string, table_name string, target string, policy_function string")
    for row in rows:
        print(row)
    assert len(masks) == len(spec["policy"]["masked_columns"]), masks
    assert len(filters) == 2, filters

# COMMAND ----------

policy_inventory(args, spark)
