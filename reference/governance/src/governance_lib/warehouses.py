"""Warehouse type audit helpers. Pure functions, unit tested; the notebook supplies the SDK objects."""

from __future__ import annotations

# Documented auto-stop defaults: pro and classic 45 minutes, serverless 10 minutes.
AUTO_STOP_DEFAULT = {"serverless": 10, "pro": 45, "classic": 45}

NOT_SERVERLESS_REASON = {
    "pro": "Pro has no Intelligent Workload Management, starts in about 4 minutes, and you own the cluster count. Serverless is the default choice where it is available.",
    "classic": "Classic has no Predictive IO or Intelligent Workload Management, starts in about 4 minutes, and cannot run AI Functions, materialized views, streaming tables, or Genie Agents.",
    "unknown": "The API did not report a warehouse type. Set warehouse_type and enable_serverless_compute explicitly.",
}


def warehouse_class(warehouse_type: str | None, serverless: bool | None) -> str:
    """Return serverless, pro, classic, or unknown.

    The API reports a serverless warehouse as warehouse_type PRO with enable_serverless_compute true.
    """
    kind = (warehouse_type or "").upper()
    if kind == "PRO":
        return "serverless" if serverless else "pro"
    if kind == "CLASSIC":
        return "classic"
    return "unknown"


def auto_stop_flag(kind: str, auto_stop_minutes: int | None) -> str | None:
    """Reason text when auto-stop is above the documented default, or never stops (0)."""
    default = AUTO_STOP_DEFAULT.get(kind, 45)
    if auto_stop_minutes is None:
        return None
    if auto_stop_minutes == 0:
        return "Auto-stop is off, so the warehouse bills until someone stops it. Set a limit of " f"{default} minutes or less."
    if auto_stop_minutes > default:
        return (f"Auto-stop of {auto_stop_minutes} minutes is above the {default}-minute default for {kind}. "
                "An idle warehouse keeps accruing charges until it stops, so shorten it.")
    return None


def audit_row(warehouse_id: str, name: str, warehouse_type: str | None, serverless: bool | None, size: str | None,
              min_clusters: int | None, max_clusters: int | None, auto_stop_minutes: int | None, state: str | None) -> dict:
    kind = warehouse_class(warehouse_type, serverless)
    flags: list[str] = []
    if kind != "serverless":
        flags.append(f"not serverless: {NOT_SERVERLESS_REASON[kind]}")
    stop = auto_stop_flag(kind, auto_stop_minutes)
    if stop:
        flags.append(stop)
    return {
        "warehouse_id": warehouse_id, "name": name, "warehouse_class": kind, "size": size or "",
        "min_clusters": min_clusters, "max_clusters": max_clusters, "auto_stop_minutes": auto_stop_minutes,
        "auto_stop_default_minutes": AUTO_STOP_DEFAULT.get(kind, 45), "state": state or "",
        "is_serverless": kind == "serverless", "flagged": bool(flags), "flags": " | ".join(flags),
    }


def serverless_request_body(name: str, size: str = "Small", min_clusters: int = 1, max_clusters: int = 2,
                            auto_stop_minutes: int = 10) -> dict:
    """The POST /api/2.0/sql/warehouses body that creates a serverless warehouse explicitly."""
    return {
        "name": name, "cluster_size": size, "min_num_clusters": min_clusters, "max_num_clusters": max_clusters,
        "auto_stop_mins": auto_stop_minutes, "warehouse_type": "PRO", "enable_serverless_compute": True,
    }
