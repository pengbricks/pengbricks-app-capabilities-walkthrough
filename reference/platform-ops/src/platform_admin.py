"""Routine administration tasks, scripted with the SDK. Each task is idempotent and records to admin_actions.

Only objects named capability-guides-* are created or changed. Nothing is deleted.
"""

from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone

from admin_lib import (
    LEDGER_DDL,
    action,
    cutoff_ms,
    evaluate_warehouse,
    is_owned_name,
    load_admin_spec,
    record,
    tokens_expiring,
)
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import DatabricksError, ResourceAlreadyExists


def init_ledger(spark, table, **_):
    spark.sql(LEDGER_DDL.format(table=table))
    return [action("setup", "ensure_ledger", table, "ok", "admin_actions table ready")]


def workspace_checks(w, spark, spec, **_):
    rows = []
    me = w.current_user.me()
    groups = [g.display for g in (me.groups or [])]
    rows.append(action("workspace", "caller_identity", me.user_name or "unknown", "ok", f"member of {len(groups)} groups; admins={'admins' in groups}"))
    rows.append(action("workspace", "workspace_info", str(w.get_workspace_id()), "ok", f"host={w.config.host}"))
    try:
        ms = w.metastores.current()
        rows.append(action("workspace", "metastore", ms.metastore_id, "ok", f"region={getattr(ms, 'region', None)}"))
    except DatabricksError as e:
        rows.append(action("workspace", "metastore", "current", "error", str(e)))
    try:
        conf = w.workspace_conf.get_status(",".join(spec["workspace_conf_keys"]))
        for key in spec["workspace_conf_keys"]:
            rows.append(action("workspace", "setting", key, "ok", f"value={conf.get(key)!r}"))
    except DatabricksError as e:
        rows.append(action("workspace", "settings", "workspace_conf", "not_allowed", str(e)))
    return rows


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


def policies(w, spark, spec, **_):
    rows = []
    # 1) Serverless budget policy
    name = spec["budget_policy_name"]
    assert is_owned_name(name)
    try:
        # Budget policies are managed through the account-level API. Probe the workspace-level path first.
        listing = w.api_client.do("GET", "/api/2.1/budget-policies")
        found = [p for p in listing.get("policies", []) if p.get("policy_name") == name]
        if found:
            rows.append(action("policy", "budget_policy", name, "unchanged", f"policy id {found[0].get('policy_id')}"))
        else:
            body = {"policy": {"policy_name": name, "custom_tags": spec["budget_policy_tags"]}}
            created = w.api_client.do("POST", "/api/2.1/budget-policies", body=body)
            rows.append(action("policy", "budget_policy", name, "created", f"policy id {created.get('policy_id')}"))
    except Exception as e:  # noqa: BLE001 - record whatever the workspace says
        rows.append(action("policy", "budget_policy", name, "not_allowed", f"{type(e).__name__}: {e}; applying a cluster policy instead"))
    # 2) Cluster policy
    cname = spec["cluster_policy_name"]
    assert is_owned_name(cname)
    import json

    try:
        definition = json.dumps(spec["cluster_policy_definition"], sort_keys=True)
        found = [p for p in w.cluster_policies.list() if p.name == cname]
        if found:
            if json.loads(found[0].definition or "{}") != json.loads(definition):
                w.cluster_policies.edit(policy_id=found[0].policy_id, name=cname, definition=definition)
                rows.append(action("policy", "cluster_policy", cname, "changed", f"definition updated on {found[0].policy_id}"))
            else:
                rows.append(action("policy", "cluster_policy", cname, "unchanged", f"policy id {found[0].policy_id}"))
        else:
            created = w.cluster_policies.create(name=cname, definition=definition)
            rows.append(action("policy", "cluster_policy", cname, "created", f"policy id {created.policy_id}"))
    except Exception as e:  # noqa: BLE001
        rows.append(action("policy", "cluster_policy", cname, "not_allowed", f"{type(e).__name__}: {e}"))
    return rows


def capacity(w, spark, spec, **_):
    rows = []
    n = 0
    for wh in w.warehouses.list():
        n += 1
        rows.append(
            evaluate_warehouse(
                wh.name,
                wh.cluster_size or "unknown",
                wh.auto_stop_mins,
                bool(wh.enable_serverless_compute),
                spec["warehouse_max_auto_stop_mins"],
            )
        )
    rows.append(action("capacity", "warehouse_inventory", "all", "ok", f"{n} warehouses listed"))
    days = spec["usage_lookback_days"]
    try:
        usage = spark.sql(
            f"""SELECT sku_name, ROUND(SUM(usage_quantity), 2) AS dbus
                FROM system.billing.usage
                WHERE usage_date >= date_sub(current_date(), {days}) AND sku_name LIKE '%SERVERLESS%'
                GROUP BY sku_name ORDER BY dbus DESC LIMIT 10"""
        ).collect()
        if usage:
            for r in usage:
                rows.append(action("capacity", "serverless_usage", r["sku_name"], "ok", f"{r['dbus']} DBUs in last {days} days"))
        else:
            rows.append(action("capacity", "serverless_usage", "all", "ok", f"no serverless usage rows in last {days} days"))
    except Exception as e:  # noqa: BLE001
        rows.append(action("capacity", "serverless_usage", "system.billing.usage", "not_allowed", str(e)[:500]))
    return rows


def audit_access(w, spark, spec, **_):
    days = spec["audit_lookback_days"]
    services = ", ".join(f"'{s}'" for s in spec["audit_services"])
    try:
        out = spark.sql(
            f"""SELECT service_name, action_name, COUNT(*) AS events, COUNT(DISTINCT user_identity.email) AS actors
                FROM system.access.audit
                WHERE event_date >= date_sub(current_date(), {days})
                  AND service_name IN ({services})
                  AND (action_name RLIKE '^(create|delete|update|edit|set|grant|add|remove|change|reset)'
                       OR action_name LIKE '%Permission%' OR action_name LIKE '%Policy%')
                GROUP BY service_name, action_name ORDER BY events DESC LIMIT 15"""
        ).collect()
    except Exception as e:  # noqa: BLE001
        return [action("audit", "admin_actions_7d", "system.access.audit", "not_allowed", str(e)[:500])]
    rows = [action("audit", "admin_actions_7d", f"{r['service_name']}.{r['action_name']}", "ok", f"{r['events']} events by {r['actors']} actors") for r in out]
    rows.append(action("audit", "admin_actions_7d", "summary", "ok", f"{len(out)} service/action pairs in last {days} days"))
    return rows


def routine_support(w, spark, spec, **_):
    rows = []
    hours = spec["failed_job_lookback_hours"]
    failed = [
        r
        for r in w.jobs.list_runs(completed_only=True, start_time_from=cutoff_ms(hours), expand_tasks=False)
        if r.state and r.state.result_state and r.state.result_state.value == "FAILED"
    ]
    for r in failed[:20]:
        rows.append(action("support", "failed_job_run", f"{r.job_id}/{r.run_id}", "flagged", f"{r.run_name or 'run'}: {r.state.state_message or ''}"[:500]))
    rows.append(action("support", "failed_jobs_24h", "summary", "ok", f"{len(failed)} failed runs in last {hours} hours"))
    now_ms = int(time.time() * 1000)
    try:
        toks = [{"token_id": t.token_id, "expiry_time": t.expiry_time, "owner": t.owner_id} for t in w.token_management.list()]
        soon = tokens_expiring(toks, now_ms, spec["token_expiry_warning_days"])
        for t in soon[:20]:
            exp = datetime.fromtimestamp(t["expiry_time"] / 1000, timezone.utc).date()
            rows.append(action("support", "expiring_token", t["token_id"], "flagged", f"expires {exp}"))
        rows.append(action("support", "tokens_expiring", "summary", "ok", f"{len(soon)} of {len(toks)} workspace tokens expire within {spec['token_expiry_warning_days']} days"))
    except DatabricksError as e:
        rows.append(action("support", "tokens_expiring", "token_management", "not_allowed", str(e)[:500]))
    return rows


TASKS = {
    "init_ledger": init_ledger,
    "workspace_checks": workspace_checks,
    "roles": roles,
    "policies": policies,
    "capacity": capacity,
    "audit_access": audit_access,
    "routine_support": routine_support,
}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--task", required=True, choices=sorted(TASKS))
    p.add_argument("--catalog", required=True)
    p.add_argument("--schema", required=True)
    p.add_argument("--use-case-file", required=True)
    p.add_argument("--run-id", required=True)
    a = p.parse_args()
    from databricks.sdk.runtime import spark

    spec = load_admin_spec(a.use_case_file)
    table = f"{a.catalog}.{a.schema}.admin_actions"
    w = WorkspaceClient()
    rows = TASKS[a.task](w=w, spark=spark, spec=spec, table=table, catalog=a.catalog, schema=a.schema)
    record(spark, table, a.run_id, rows)
    for r in rows:
        print(f"[{r['status']}] {r['category']}/{r['action']} {r['target']}: {r['detail']}")


if __name__ == "__main__":
    main()
