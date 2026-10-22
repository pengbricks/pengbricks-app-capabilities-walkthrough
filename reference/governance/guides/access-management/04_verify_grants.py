# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Verify the grants
# MAGIC
# MAGIC Reads `information_schema` back and asserts three things: no person holds an explicit grant, dev and prod differ as intended, and prod exposes only the named tables.

# MAGIC
# MAGIC Safe to rerun: it only reads `information_schema`, and `access_effective_grants` is replaced.
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

def verify_grants(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    principal = run_sql_rows(spark, f"SELECT grantee_used FROM {qualified(args.catalog, args.schema, 'access_group')}")[0]["grantee_used"]
    info = f"{qualified(args.catalog)}.information_schema"
    rows: list[dict] = []
    for env, schema in env_schemas(args).items():
        for r in run_sql_rows(spark, f"SELECT grantee, privilege_type, inherited_from FROM {info}.schema_privileges WHERE schema_name = '{schema}'"):
            rows.append({"environment": env, "securable": f"schema {schema}", "grantee": r["grantee"], "privilege": r["privilege_type"], "inherited_from": r["inherited_from"]})
        for r in run_sql_rows(spark, f"SELECT grantee, table_name, privilege_type, inherited_from FROM {info}.table_privileges WHERE table_schema = '{schema}'"):
            rows.append({"environment": env, "securable": f"table {schema}.{r['table_name']}", "grantee": r["grantee"], "privilege": r["privilege_type"], "inherited_from": r["inherited_from"]})
    write_rows(spark, args.catalog, args.schema, "access_effective_grants", rows,
               "environment string, securable string, grantee string, privilege string, inherited_from string")

    def held(env: str, kind: str = "") -> set[str]:
        return {r["privilege"] for r in rows if r["environment"] == env and r["grantee"] == principal
                and r["inherited_from"] == "NONE" and r["securable"].startswith(kind)}

    # Group-based: no person holds an explicit grant (inherited_from NONE) on either schema.
    # The catalog owner shows up with privileges inherited from the catalog; those are not grants made here.
    people = sorted({r["grantee"] for r in rows if principal_kind(r["grantee"]) == "user" and r["inherited_from"] == "NONE"})
    assert not people, f"grants to individual users: {people}"
    # Environment difference.
    assert {"SELECT", "MODIFY", "CREATE_TABLE"} <= held("dev", "schema"), held("dev", "schema")
    assert not {"MODIFY", "CREATE_TABLE", "SELECT"} & held("prod", "schema"), held("prod", "schema")
    # Object-level: prod reader gets orders only.
    granted_tables = {r["securable"] for r in rows if r["environment"] == "prod" and r["grantee"] == principal
                      and r["inherited_from"] == "NONE" and r["securable"].startswith("table")}
    expected = {f"table {args.prod_schema}.{t}" for t in spec["access"]["environments"]["prod"]["table_privileges"]}
    assert granted_tables == expected, (granted_tables, expected)
    print(f"verified: {principal} dev={sorted(held('dev', 'schema'))} prod tables={sorted(granted_tables)}")

# COMMAND ----------

verify_grants(args, spark)
