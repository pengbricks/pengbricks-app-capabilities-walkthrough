# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Apply grants
# MAGIC
# MAGIC Grants the group schema and table privileges that differ by environment: broad read-write on dev, read-only on named tables in prod. Grants are idempotent, so rerunning changes nothing.

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

def apply_grants(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    group = run_sql_rows(spark, f"SELECT grantee_used FROM {qualified(args.catalog, args.schema, 'access_group')}")
    principal = group[0]["grantee_used"]
    assert principal_kind(principal) == "group", principal
    applied = []
    for env, schema in env_schemas(args).items():
        config = spec["access"]["environments"][env]
        statements = [grant_sql(["USE_CATALOG"], "CATALOG", qualified(args.catalog), principal)]
        statements.append(grant_sql(config["privileges"], "SCHEMA", qualified(args.catalog, schema), principal))
        for table, privileges in config["table_privileges"].items():
            statements.append(grant_sql(privileges, "TABLE", qualified(args.catalog, schema, table), principal))
        for statement in statements:
            spark.sql(statement)
            applied.append({"environment": env, "schema_name": schema, "principal": principal, "statement": statement})
            print(statement)
    write_rows(spark, args.catalog, args.schema, "access_grants_applied", applied,
               "environment string, schema_name string, principal string, statement string")

# COMMAND ----------

apply_grants(args, spark)
