# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Ensure the reader group
# MAGIC
# MAGIC Creates the workspace group if it is missing, adds the app service principal to it (never a person), and tests whether Unity Catalog can grant to it. Workspace-local groups cannot receive grants, so the notebook falls back to the built-in `account users` group and records which one it used in `access_group`.

# MAGIC
# MAGIC Safe to rerun: the group is reused if it exists, the service principal is added only when it is missing, and the `access_group` table is replaced.
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

# COMMAND ----------

from common import require_system_tables
require_system_tables(spark, "access.audit")  # step 05 reads it; stop before the group is created
ensure_group(args, spark)
