# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Create the policies
# MAGIC
# MAGIC Creates the principal-to-region mapping table, a mask function per sensitive column, an attribute row filter and a dynamic row filter, and attaches them with `ALTER TABLE`. Changing who sees what is an `INSERT` into the mapping table, not a policy rewrite.

# MAGIC
# MAGIC Safe to rerun: the mapping table and mask and filter functions use `CREATE OR REPLACE`, and `SET MASK` and `SET ROW FILTER` replace what is attached.
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

def names(args, spec):
    policy = spec["policy"]
    q = lambda *p: qualified(args.catalog, args.schema, *p)  # noqa: E731
    return policy, q

def shared_table(spec, table: str) -> str:
    """Physical name in the shared schema: the spec's logical table name plus the bundle prefix."""
    return f"{spec.get('shared_table_prefix', '')}{table}"

def create_policies(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    policy, q = names(args, spec)
    role, admin = policy["restricted_role"], policy["admin_group"]
    mapping = policy["dynamic_filter"]["mapping_table"]

    # Mapping table: principal -> region. Changing access is an INSERT, not a policy rewrite.
    spark.sql(f"""CREATE OR REPLACE TABLE {q(mapping)} (
        principal STRING COMMENT 'What session_user() returns: a user email, a service principal ID, or a role name',
        region STRING COMMENT 'Region this principal may see',
        granted_at TIMESTAMP)""")
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    rows = [
        (args.app_service_principal if m["principal"] == "app_service_principal" else m["principal"], region, now)
        for m in policy["mapping"] for region in m["regions"]
    ]
    spark.createDataFrame(rows, "principal string, region string, granted_at timestamp").write.mode("append").saveAsTable(
        qualified(args.catalog, args.schema, mapping))

    # Column masks: one function per mask kind, attached to each sensitive column.
    for item in policy["masked_columns"]:
        function = q(f"mask_{item['column']}")
        spark.sql(mask_function_sql(function, item["mask"], role, admin))
        spark.sql(f"ALTER TABLE {q(shared_table(spec, item['table']))} ALTER COLUMN {qualified(item['column'])} SET MASK {function}")
        print(f"mask {function} on {shared_table(spec, item['table'])}.{item['column']}")

    # Row filter by attribute.
    attribute = policy["attribute_filter"]
    function = q(f"filter_{attribute['table']}_{attribute['column']}")
    spark.sql(attribute_filter_sql(function, attribute["hidden_value"], admin))
    spark.sql(f"ALTER TABLE {q(shared_table(spec, attribute['table']))} SET ROW FILTER {function} ON ({qualified(attribute['column'])})")

    # Dynamic row filter: permitted regions come from the mapping table, keyed on session_user().
    dynamic = policy["dynamic_filter"]
    function = q(f"filter_{dynamic['table']}_{dynamic['column']}")
    spark.sql(dynamic_filter_sql(function, q(mapping), role, admin))
    spark.sql(f"ALTER TABLE {q(shared_table(spec, dynamic['table']))} SET ROW FILTER {function} ON ({qualified(dynamic['column'])})")
    print("policies applied")

# COMMAND ----------

create_policies(args, spark)
