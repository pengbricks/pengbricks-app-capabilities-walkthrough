"""Access management: group, environment schemas, grants, verification, audit, service principals."""

from __future__ import annotations

import datetime as dt

from common import base_args, run_sql_rows, workspace_id, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import grant_sql, principal_kind, qualified

FALLBACK_GROUP = "account users"


def ensure_group(args, spark) -> None:
    """Create the workspace group if it is missing, add the app service principal, and test grantability."""
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.iam import ComplexValue, Patch, PatchOp, PatchSchema

    w = WorkspaceClient()
    existing = list(w.groups.list(filter=f'displayName eq "{args.reader_group}"'))
    group = existing[0] if existing else w.groups.create(display_name=args.reader_group)
    print(f"group {args.reader_group}: {'found' if existing else 'created'} (id {group.id})")

    # Membership goes through the group: the app service principal joins, never a person.
    sp_list = list(w.service_principals.list(filter=f'applicationId eq "{args.app_service_principal}"'))
    members = {m.value for m in (w.groups.get(group.id).members or [])}
    if sp_list and sp_list[0].id not in members:
        w.groups.patch(
            group.id,
            operations=[Patch(op=PatchOp.ADD, value={"members": [{"value": sp_list[0].id}]})],
            schemas=[PatchSchema.URN_IETF_PARAMS_SCIM_API_MESSAGES_2_0_PATCH_OP],
        )
    resource_type = (group.meta.resource_type if group.meta else None) or "unknown"
    principal, grantable = resolve_grantee(spark, args)
    rows = [{
        "group_name": args.reader_group,
        "group_id": str(group.id),
        "resource_type": resource_type,
        "unity_catalog_grantable": grantable,
        "grantee_used": principal,
        "checked_at": dt.datetime.now(dt.timezone.utc).replace(tzinfo=None),
    }]
    write_rows(spark, args.catalog, args.schema, "access_group",
               rows, "group_name string, group_id string, resource_type string, "
                     "unity_catalog_grantable boolean, grantee_used string, checked_at timestamp")


def resolve_grantee(spark, args) -> tuple[str, bool]:
    """Return (principal, grantable). Workspace-local groups are not Unity Catalog principals.

    Only account-level groups can receive grants. When the configured group is workspace-local, fall
    back to the built-in account-level group so the demo still grants through a group.
    """
    probe = qualified(args.catalog, args.dev_schema)
    try:
        spark.sql(grant_sql(["USE_SCHEMA"], "SCHEMA", probe, args.reader_group))
        return args.reader_group, True
    except Exception as exc:  # noqa: BLE001
        if "PRINCIPAL_DOES_NOT_EXIST" not in str(exc):
            raise
        print(f"{args.reader_group} is a workspace-local group and cannot receive Unity Catalog grants; "
              f"using {FALLBACK_GROUP}")
        return FALLBACK_GROUP, False


def env_schemas(args) -> dict[str, str]:
    return {"dev": args.dev_schema, "prod": args.prod_schema}


def create_data(args, spark) -> None:
    spec = load_spec(args.use_case_file)
    for env, schema in env_schemas(args).items():
        for table, rows in spec["access"]["rows_per_table"].items():
            count = write_table(spark, spec, args.catalog, schema, table, rows)
            print(f"{env}: {schema}.{table} = {count} rows")


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


def check_audit(args, spark) -> None:
    """Read back the grant-change table written by sql/permission_audit_task.sql."""
    table = qualified(args.catalog, args.schema, "access_audit_grant_changes")
    total = spark.sql(f"SELECT count(*) c FROM {table}").first()["c"]
    ours = spark.sql(f"""SELECT count(*) c FROM {table} WHERE securable LIKE '%{args.dev_schema}%' OR securable LIKE '%{args.prod_schema}%'""").first()["c"]
    print(f"grant changes in the last 30 days in this catalog: {total}; on this guide's schemas: {ours}")


def list_service_principals(args, spark) -> None:
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    rows = []
    for sp in w.service_principals.list():
        try:
            secrets = list(w.service_principal_secrets_proxy.list(service_principal_id=int(sp.id)))
        except Exception:  # noqa: BLE001
            secrets = []
        expiry = [s.expire_time for s in secrets if s.expire_time]
        created = [s.create_time for s in secrets if s.create_time]
        rows.append({
            "display_name": sp.display_name or "",
            "application_id": sp.application_id or "",
            "active": bool(sp.active),
            "roles": ", ".join(sorted(g.display for g in (sp.groups or []) if g.display)) or "(none)",
            "entitlements": ", ".join(sorted(e.value for e in (sp.entitlements or []))) or "(none)",
            "is_app_service_principal": sp.application_id == args.app_service_principal,
            "oauth_secret_count": len(secrets),
            "oldest_secret_created": min(created) if created else "",
            "latest_secret_expires": max(expiry) if expiry else "",
        })
    write_rows(spark, args.catalog, args.schema, "access_service_principals", rows,
               "display_name string, application_id string, active boolean, roles string, entitlements string, "
               "is_app_service_principal boolean, oauth_secret_count int, oldest_secret_created string, latest_secret_expires string")


STEPS = {
    "ensure_group": ensure_group,
    "create_data": create_data,
    "apply_grants": apply_grants,
    "verify_grants": verify_grants,
    "check_audit": check_audit,
    "list_service_principals": list_service_principals,
}

if __name__ == "__main__":
    from databricks.sdk.runtime import spark

    arguments = base_args("reader-group", "app-service-principal", "dev-schema", "prod-schema")
    STEPS[arguments.step](arguments, spark)
