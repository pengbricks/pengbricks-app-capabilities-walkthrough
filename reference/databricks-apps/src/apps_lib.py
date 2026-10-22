"""Pure helpers for the Databricks Apps guide. No workspace calls, so pytest runs them anywhere.

The notebooks pass in what the SDK returns (as_dict() output) and get plain values back.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import yaml

# Hourly DBU rate by compute size. Apps without a compute size use Medium.
DBU_PER_HOUR = {"MEDIUM": 0.5, "LARGE": 1.0, "XLARGE": 3.0}
DEFAULT_COMPUTE_SIZE = "MEDIUM"
HOURS_PER_MONTH = 730

# Key under an app resource that names its type.
RESOURCE_TYPES = (
    "sql_warehouse", "serving_endpoint", "secret", "job", "database", "postgres",
    "experiment", "genie_space", "uc_securable", "app",
)

INVENTORY_COLUMNS = (
    "app_name", "url", "compute_size", "dbu_per_hour", "app_state", "compute_state",
    "deployment_id", "deployment_state", "source_code_path", "resources", "user_api_scopes",
    "service_principal_name", "service_principal_client_id", "captured_at", "run_id",
)


# ---- app.yaml -------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class EnvVar:
    name: str
    value: str | None = None
    value_from: str | None = None


def parse_app_yaml(text: str) -> dict[str, Any]:
    """Parse app.yaml text into {'command': [...], 'env': [EnvVar, ...]}. An empty file gives no command and no env."""
    raw = yaml.safe_load(text) or {}
    env = []
    for entry in raw.get("env") or []:
        if "name" not in entry:
            raise ValueError(f"env entry without a name: {entry}")
        if ("value" in entry) == ("valueFrom" in entry):
            raise ValueError(f"env {entry['name']}: set exactly one of value and valueFrom")
        env.append(EnvVar(entry["name"], entry.get("value"), entry.get("valueFrom")))
    return {"command": list(raw.get("command") or []), "env": env}


def value_from_keys(env: list[EnvVar]) -> list[str]:
    """Resource keys that app.yaml reads with valueFrom, in file order, without repeats."""
    return list(dict.fromkeys(e.value_from for e in env if e.value_from))


def missing_resource_keys(env: list[EnvVar], declared_keys: list[str]) -> list[str]:
    """valueFrom keys that no declared resource provides. A deploy with any of these fails."""
    return [key for key in value_from_keys(env) if key not in set(declared_keys)]


def resolve_env(env: list[EnvVar], resource_values: dict[str, str]) -> dict[str, str]:
    """Final environment: fixed values as written, valueFrom entries looked up by resource key."""
    missing = missing_resource_keys(env, list(resource_values))
    if missing:
        raise KeyError(f"no resource declares key(s): {', '.join(missing)}")
    return {e.name: (e.value if e.value_from is None else resource_values[e.value_from]) for e in env}


# ---- reading an app ----------------------------------------------------------------------------------------

def compute_size_of(app: dict) -> str:
    return (app.get("compute_size") or DEFAULT_COMPUTE_SIZE).upper()


def dbu_per_hour(app: dict) -> float:
    return DBU_PER_HOUR.get(compute_size_of(app), DBU_PER_HOUR[DEFAULT_COMPUTE_SIZE])


def describe_resource(resource: dict) -> dict[str, str]:
    """Name, type, and permission of one app resource as the API returns it."""
    kind = next((k for k in RESOURCE_TYPES if resource.get(k)), "unknown")
    detail = resource.get(kind) or {}
    return {
        "name": resource.get("name", ""),
        "type": kind,
        "permission": str(detail.get("permission", "")) if isinstance(detail, dict) else "",
    }


def app_state(app: dict) -> str:
    return ((app.get("app_status") or {}).get("state") or "UNKNOWN").upper()


def compute_state(app: dict) -> str:
    return ((app.get("compute_status") or {}).get("state") or "UNKNOWN").upper()


def is_billing(app: dict) -> bool:
    """An app bills compute while it is running. Stopped, deploying, and crashed apps do not."""
    return app_state(app) == "RUNNING"


def is_stopped(app: dict) -> bool:
    return compute_state(app) == "STOPPED"


def inventory_row(app: dict, run_id: str, captured_at: datetime) -> dict[str, Any]:
    """One flat row for databricks_apps_inventory."""
    deployment = app.get("active_deployment") or {}
    resources = [describe_resource(r) for r in app.get("resources") or []]
    return {
        "app_name": app.get("name", ""),
        "url": app.get("url", ""),
        "compute_size": compute_size_of(app),
        "dbu_per_hour": dbu_per_hour(app),
        "app_state": app_state(app),
        "compute_state": compute_state(app),
        "deployment_id": deployment.get("deployment_id", ""),
        "deployment_state": ((deployment.get("status") or {}).get("state") or "NONE"),
        "source_code_path": deployment.get("source_code_path", ""),
        "resources": "; ".join(f"{r['name']} ({r['type']}, {r['permission']})" for r in resources),
        "user_api_scopes": ", ".join(app.get("user_api_scopes") or []),
        "service_principal_name": app.get("service_principal_name", ""),
        "service_principal_client_id": app.get("service_principal_client_id", ""),
        "captured_at": captured_at,
        "run_id": run_id,
    }


def inventory_merge_sql(table: str, row: dict[str, Any]) -> str:
    """MERGE keyed on app_name: a rerun updates the app's row and never adds a second one."""
    def lit(value: Any) -> str:
        if isinstance(value, datetime):
            return f"TIMESTAMP '{value.strftime('%Y-%m-%d %H:%M:%S')}'"
        if isinstance(value, (int, float)):
            return str(value)
        return "'" + str(value).replace("'", "''") + "'"

    values = ", ".join(f"{lit(row[c])} AS {c}" for c in INVENTORY_COLUMNS)
    return (
        f"MERGE INTO {table} t USING (SELECT {values}) s ON t.app_name = s.app_name "
        "WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *"
    )


# ---- cost and idle detection ---------------------------------------------------------------------------------

def last_change(app: dict) -> datetime | None:
    """Latest of the app update time and the active deployment update time, as a UTC datetime."""
    stamps = [app.get("update_time"), (app.get("active_deployment") or {}).get("update_time")]
    parsed = [parse_time(s) for s in stamps if s]
    return max(parsed) if parsed else None


def parse_time(stamp: str) -> datetime:
    value = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def is_idle(app: dict, now: datetime, idle_days: int) -> bool:
    """Running, and no deployment or update for idle_days.

    The Apps API exposes no request count, so this is a proxy. Confirm with the app's Insights tab
    (Beta) before you stop an app that flags here.
    """
    if not is_billing(app):
        return False
    changed = last_change(app)
    return changed is None or now - changed >= timedelta(days=idle_days)


def monthly_dbu(app: dict) -> float:
    """DBU per month if the app stays running; 0 for an app that does not bill."""
    return round(dbu_per_hour(app) * HOURS_PER_MONTH, 1) if is_billing(app) else 0.0


def cost_row(app: dict, now: datetime, idle_days: int) -> dict[str, Any]:
    changed = last_change(app)
    flag = "running and idle" if is_idle(app, now, idle_days) else ("running" if is_billing(app) else "not billing")
    return {
        "app_name": app.get("name", ""),
        "compute_size": compute_size_of(app),
        "app_state": app_state(app),
        "compute_state": compute_state(app),
        "resources": ", ".join(f"{r['type']}:{r['name']}" for r in map(describe_resource, app.get("resources") or [])),
        "days_since_change": None if changed is None else (now - changed).days,
        "dbu_per_month_if_running": monthly_dbu(app),
        "flag": flag,
    }


# ---- cleanup ---------------------------------------------------------------------------------------------------

def cleanup_action(app: dict | None, stop_app: str) -> str:
    """Decide what the cleanup task does. Only 'stop' changes anything.

    keep                  stop_app is not "true"
    noop_missing          the app does not exist
    noop_already_stopped  compute is STOPPED, or already STOPPING
    stop                  the app is running or starting
    """
    if str(stop_app).strip().lower() != "true":
        return "keep"
    if app is None:
        return "noop_missing"
    if compute_state(app) in ("STOPPED", "STOPPING"):
        return "noop_already_stopped"
    return "stop"


# ---- App Spaces -----------------------------------------------------------------------------------------------

def spaces_preview_status(error: Exception | None) -> str:
    """Read the result of listing App Spaces: 'on' when the call worked, else 'off or no access'."""
    return "on" if error is None else "off or no access"


UI_STEPS = [
    "A workspace admin opens Settings, then Previews, and turns on 'Governed agentic app-building'.",
    "In the Apps area, open App Spaces and create a space. Set its user authorization scopes, serverless usage policy, and permissions.",
    "Grant CAN CREATE APP to the people who will build. The space name cannot be changed later.",
    "Builders open the Build tab on the Apps home page, pick the space, and enter a prompt. Genie App Builder only builds inside a space.",
]
