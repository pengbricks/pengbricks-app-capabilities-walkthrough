"""Row and column security: sample data, masks, row filters, identity tests, and the policy inventory."""

from __future__ import annotations

import datetime as dt

from common import base_args, run_sql_rows, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import (
    attribute_filter_body,
    attribute_filter_sql,
    dynamic_filter_body,
    dynamic_filter_sql,
    mask_body,
    mask_function_sql,
    qualified,
)


def names(args, spec):
    policy = spec["policy"]
    q = lambda *p: qualified(args.catalog, args.schema, *p)  # noqa: E731
    return policy, q


def generate_data(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    for table in spec["tables"]:
        # Drop first: a table that already carries a mask or filter cannot be overwritten in place.
        spark.sql(f"DROP TABLE IF EXISTS {qualified(args.catalog, args.schema, table)}")
        print(f"{table}: {write_table(spark, spec, args.catalog, args.schema, table)} rows")


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
        spark.sql(f"ALTER TABLE {q(item['table'])} ALTER COLUMN {qualified(item['column'])} SET MASK {function}")
        print(f"mask {function} on {item['table']}.{item['column']}")

    # Row filter by attribute.
    attribute = policy["attribute_filter"]
    function = q(f"filter_{attribute['table']}_{attribute['column']}")
    spark.sql(attribute_filter_sql(function, attribute["hidden_value"], admin))
    spark.sql(f"ALTER TABLE {q(attribute['table'])} SET ROW FILTER {function} ON ({qualified(attribute['column'])})")

    # Dynamic row filter: permitted regions come from the mapping table, keyed on session_user().
    dynamic = policy["dynamic_filter"]
    function = q(f"filter_{dynamic['table']}_{dynamic['column']}")
    spark.sql(dynamic_filter_sql(function, q(mapping), role, admin))
    spark.sql(f"ALTER TABLE {q(dynamic['table'])} SET ROW FILTER {function} ON ({qualified(dynamic['column'])})")
    print("policies applied")


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
        cust, orders = q(dyn["table"]), q(attr["table"])
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


def policy_inventory(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    info = f"{qualified(args.catalog)}.information_schema"
    masks = run_sql_rows(spark, f"""SELECT table_name, column_name AS target, mask_name AS policy_function
        FROM {info}.column_masks WHERE table_schema = '{args.schema}'""")
    filters = run_sql_rows(spark, f"""SELECT table_name, target_columns AS target, filter_name AS policy_function
        FROM {info}.row_filters WHERE table_schema = '{args.schema}'""")
    rows = [{"policy_type": "column mask", **r} for r in masks] + [{"policy_type": "row filter", **r} for r in filters]
    write_rows(spark, args.catalog, args.schema, "policy_inventory", rows,
               "policy_type string, table_name string, target string, policy_function string")
    for row in rows:
        print(row)
    assert len(masks) == len(spec["policy"]["masked_columns"]), masks
    assert len(filters) == 2, filters


STEPS = {
    "generate_data": generate_data,
    "create_policies": create_policies,
    "test_policies": test_policies,
    "policy_inventory": policy_inventory,
}

if __name__ == "__main__":
    from databricks.sdk.runtime import spark

    arguments = base_args("app-service-principal")
    STEPS[arguments.step](arguments, spark)
