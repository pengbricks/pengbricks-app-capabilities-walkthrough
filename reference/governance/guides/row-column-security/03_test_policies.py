# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Test the policies as different identities
# MAGIC
# MAGIC Reads the tables as the job identity and evaluates the same policy logic for a restricted role and for the app service principal. It asserts that the job identity (an admin) sees everything, that the logic reproduces the real policy, and that the other identities see less.

# MAGIC
# MAGIC Safe to rerun: it only reads the tables, and `policy_test_results` is replaced.
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

def _identity_rows(args, spark, spec) -> list[dict]:
    policy, q = names(args, spec)
    role, admin = policy["restricted_role"], policy["admin_group"]
    mapping = q(policy["dynamic_filter"]["mapping_table"])
    attr = policy["attribute_filter"]
    dyn = policy["dynamic_filter"]
    email_col, id_col = (c["column"] for c in policy["masked_columns"])
    kinds = {c["column"]: c["mask"] for c in policy["masked_columns"]}

    me = spark.sql("SELECT session_user() AS s, is_member('" + admin + "') AS m").first()
    identities = [
        # (label, mode, session expression, member expression)
        ("job identity", "actual", "session_user()", f"is_member('{admin}')"),
        ("job identity (twin)", "twin", f"'{me['s']}'", str(bool(me["m"])).lower()),
        (f"role: {role}", "simulated", f"'{role}'", "false"),
        ("app service principal", "simulated", f"'{args.app_service_principal}'", "false"),
    ]
    results = []
    for label, mode, session, member in identities:
        # 'actual' reads through the real policies; the others apply the same logic to the unfiltered
        # rows (the job identity is an admin, so the real policies let every row through).
        cust, orders = q(shared_table(spec, dyn["table"])), q(shared_table(spec, attr["table"]))
        if mode == "actual":
            cust_where, order_where = "true", "true"
            email_expr, id_expr = email_col, id_col
        else:
            cust_where = dynamic_filter_body(qualified(dyn["column"]), mapping, role, admin, session, member)
            order_where = attribute_filter_body(qualified(attr["column"]), attr["hidden_value"], admin, member)
            email_expr = mask_body(kinds[email_col], qualified(email_col), role, admin, session, member)
            id_expr = mask_body(kinds[id_col], qualified(id_col), role, admin, session, member)
        stats = spark.sql(f"""SELECT
            (SELECT count(*) FROM {cust} WHERE {cust_where}) AS customers_visible,
            (SELECT count(*) FROM {orders} WHERE {order_where}) AS orders_visible,
            (SELECT concat_ws(',', sort_array(collect_set(region))) FROM {cust} WHERE {cust_where}) AS regions,
            (SELECT max({email_expr}) FROM {cust} WHERE customer_id = 'CUST-000001') AS email_sample,
            (SELECT max({id_expr}) FROM {cust} WHERE customer_id = 'CUST-000001') AS national_id_sample""").first()
        results.append({"identity": label, "mode": mode, **stats.asDict()})
    return results

def test_policies(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    results = _identity_rows(args, spark, spec)
    ddl = ("identity string, mode string, customers_visible long, orders_visible long, regions string, "
           "email_sample string, national_id_sample string")
    write_rows(spark, args.catalog, args.schema, "policy_test_results", results, ddl)
    for row in results:
        print(row)
    by = {r["identity"]: r for r in results}
    actual, twin = by["job identity"], by["job identity (twin)"]
    total_customers = spec["tables"]["customers"]["rows"]
    # The job identity is an admin: it sees every row and the real values.
    assert actual["customers_visible"] == total_customers, actual
    assert actual["email_sample"] == "user000001@example.com", actual
    # The twin logic must reproduce the real policy for the identity we can run as.
    for key in ("customers_visible", "orders_visible", "regions", "email_sample", "national_id_sample"):
        assert actual[key] == twin[key], (key, actual[key], twin[key])
    restricted = next(r for r in results if r["identity"].startswith("role:"))
    sp = by["app service principal"]
    assert restricted["customers_visible"] < total_customers and restricted["email_sample"] is None, restricted
    assert restricted["regions"] == "EMEA,NA", restricted
    assert sp["regions"] == "APAC" and sp["email_sample"].endswith("@example.com") and sp["email_sample"] != actual["email_sample"], sp
    assert sp["orders_visible"] < actual["orders_visible"], (sp, actual)

# COMMAND ----------

test_policies(args, spark)
