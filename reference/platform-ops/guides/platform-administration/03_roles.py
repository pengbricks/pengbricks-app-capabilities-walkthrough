# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Roles
# MAGIC
# MAGIC Finds or creates the workspace group named in the spec, then tries to grant it schema access. Unity Catalog accepts only account-level groups, so the grant may be refused and recorded as `not_allowed`; the notebook then sets `CAN_USE` on the guide's cluster policy instead.
# MAGIC
# MAGIC Each row is written to `admin_actions` with a merge keyed on the run, category, action and target, so a retried or repeated task updates its own rows. Safe to rerun: the group is reused if it exists, the schema grant is issued only when a privilege is missing, and the policy permission update is additive.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_platform_admin", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

from admin_lib import is_owned_name
from databricks.sdk.errors import ResourceAlreadyExists

from admin_lib import LEDGER_DDL, action, record, load_admin_spec
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import DatabricksError

dbutils.widgets.text("run_id", "")
from datetime import datetime, timezone
# In the job, run_id is the job run. Standalone, a blank widget uses one id per day, so a rerun updates its own rows.
run_id = dbutils.widgets.get("run_id").strip() or datetime.now(timezone.utc).strftime("manual-%Y%m%d")
spec = load_admin_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
table = f"{params['catalog']}.{params['schema']}.admin_actions"
catalog, schema = params["catalog"], params["schema"]
w = WorkspaceClient()
spark.sql(LEDGER_DDL.format(table=table))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The task

# COMMAND ----------

def roles(w, spark, spec, catalog, schema, **_):
    rows = []
    name = spec["group_name"]
    assert is_owned_name(name)
    try:
        group = _find_group(w, name)
        if group is None:
            try:
                group = w.groups.create(display_name=name)
                rows.append(action("roles", "ensure_group", name, "created", f"group id {group.id}"))
            except ResourceAlreadyExists:
                # The filtered list can miss a group created a moment ago; fall back to a full scan.
                group = _find_group(w, name, scan=True)
                rows.append(action("roles", "ensure_group", name, "unchanged", f"group id {group.id if group else 'unknown'} already exists"))
        else:
            rows.append(action("roles", "ensure_group", name, "unchanged", f"group id {group.id} already exists"))
    except DatabricksError as e:
        rows.append(action("roles", "ensure_group", name, "not_allowed", str(e)))
        return rows
    privs = spec["group_schema_privileges"]
    full = f"{catalog}.{schema}"
    try:
        before = _schema_privileges(spark, full, name)
        missing = [p for p in privs if p.replace("_", " ") not in before]
        if missing:
            spark.sql(f"GRANT {', '.join(p.replace('_', ' ') for p in missing)} ON SCHEMA {full} TO `{name}`")
        after = _schema_privileges(spark, full, name)
        rows.append(action("roles", "grant_schema_access", f"{full} -> {name}", "changed" if missing else "unchanged", f"privileges now: {sorted(after)}"))
    except Exception as e:  # noqa: BLE001
        # Unity Catalog only sees account-level groups. A workspace-local group is rejected with PRINCIPAL_DOES_NOT_EXIST.
        reason = "workspace-local group is not a Unity Catalog principal; grant schema access to an account-level group" if "PRINCIPAL_DOES_NOT_EXIST" in str(e) else str(e)[:300]
        rows.append(action("roles", "grant_schema_access", f"{full} -> {name}", "not_allowed", reason))
        rows.append(_grant_policy_use(w, name, spec["cluster_policy_name"]))
    return rows


def _grant_policy_use(w, group: str, policy_name: str) -> dict[str, str]:
    """Workspace-level equivalent: let the group use the guide's cluster policy. update() adds the ACL entry and is idempotent."""
    from databricks.sdk.service.iam import AccessControlRequest, PermissionLevel

    try:
        policy = next((p for p in w.cluster_policies.list() if p.name == policy_name), None)
        if policy is None:
            return action("roles", "grant_policy_use", policy_name, "not_allowed", "cluster policy not found")
        w.permissions.update(
            "cluster-policies",
            policy.policy_id,
            access_control_list=[AccessControlRequest(group_name=group, permission_level=PermissionLevel.CAN_USE)],
        )
        return action("roles", "grant_policy_use", f"{policy_name} -> {group}", "ok", "CAN_USE set (permissions.update is additive and idempotent)")
    except Exception as e:  # noqa: BLE001
        return action("roles", "grant_policy_use", policy_name, "not_allowed", str(e)[:300])


def _find_group(w, name: str, scan: bool = False):
    groups = w.groups.list() if scan else w.groups.list(filter=f'displayName eq "{name}"')
    return next((g for g in groups if g.display_name == name), None)


def _schema_privileges(spark, full_schema: str, principal: str) -> set[str]:
    out = spark.sql(f"SHOW GRANTS ON SCHEMA {full_schema}").collect()
    return {r["ActionType"] for r in out if r["Principal"] == principal}

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it and record the result

# COMMAND ----------

rows = roles(w, spark, spec, catalog, schema)
record(spark, table, run_id, rows)
for r in rows:
    print(f"[{r['status']}] {r['category']}/{r['action']} {r['target']}: {r['detail']}")
