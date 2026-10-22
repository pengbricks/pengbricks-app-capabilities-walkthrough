"""Precondition check for the monitoring snapshot notebooks."""

from __future__ import annotations


def require_system_tables(spark, *tables: str) -> None:
    """Stop with a plain message, before anything changes, when the job identity cannot read a system table.

    Pass names without the catalog, for example "billing.usage".
    """
    missing = []
    for table in tables:
        try:
            spark.sql(f"SELECT 1 FROM system.{table} LIMIT 1").collect()
        except Exception:  # noqa: BLE001 - not enabled, not granted, or not visible: the fix is the same
            missing.append(table)
    if missing:
        schemas = sorted({t.split(".")[0] for t in missing})
        enable = "; ".join(f"databricks system-schemas enable <metastore-id> {s}" for s in schemas)
        grants = " ".join(f"GRANT USE SCHEMA ON SCHEMA system.{s} TO `<principal>`;" for s in schemas)
        grants += " " + " ".join(f"GRANT SELECT ON TABLE system.{t} TO `<principal>`;" for t in missing)
        names = ", ".join(f"system.{t}" for t in missing)
        raise RuntimeError(
            f"Cannot read {names}. Run: {enable} (get the ID with: databricks metastores current), "
            f"then as a metastore admin: GRANT USE CATALOG ON CATALOG system TO `<principal>`; {grants} Nothing was changed."
        )
