"""Pure helpers for the migrate-off-databricks guide: classify a table for an exit inventory."""

from __future__ import annotations

from typing import Any

# Delta table features that a reader must understand. The Databricks feature compatibility page
# lists each of these as "Reader and writer" (column mapping, deletion vectors, TIMESTAMP_NTZ,
# liquid clustering, type widening, variant, catalog commits). v2Checkpoint is reader-and-writer
# in the open Delta protocol spec. Row tracking is writer-only there, so it is not listed.
READER_FEATURES = {
    "deletionVectors": "deletion vectors",
    "columnMapping": "column mapping",
    "typeWidening": "type widening",
    "variantType": "VARIANT type",
    "timestampNtz": "TIMESTAMP_NTZ type",
    "v2Checkpoint": "v2 checkpoints",
    "clustering": "liquid clustering",
    "catalogManaged": "catalog commits",
}

# Verdicts, from best to worst for an exit.
RUNS_AS_IS = "runs as is"
NEEDS_CHANGES = "needs changes"
REBUILD = "rebuild"

# information_schema.tables.table_type values that hold no files of their own.
DERIVED_TYPES = {"VIEW", "MATERIALIZED_VIEW", "STREAMING_TABLE"}

# Shallow clones reference the source table's files instead of holding their own.
SHALLOW_CLONE_TYPES = {"MANAGED_SHALLOW_CLONE", "EXTERNAL_SHALLOW_CLONE"}


def props_from_rows(rows: list[Any]) -> dict[str, str]:
    """Turn SHOW TBLPROPERTIES rows (key, value) into a dict."""
    return {str(row[0]): str(row[1]) for row in rows}


def delta_features(props: dict[str, str], detail_features: list[str] | None = None) -> list[str]:
    """Names of reader-side features in use, from delta.feature.* properties and DESCRIBE DETAIL."""
    found = {name for name in (detail_features or []) if name in READER_FEATURES}
    for key, value in props.items():
        if key.startswith("delta.feature.") and value.lower() in {"supported", "enabled"}:
            name = key.removeprefix("delta.feature.")
            if name in READER_FEATURES:
                found.add(name)
    if props.get("delta.enableDeletionVectors", "").lower() == "true":
        found.add("deletionVectors")
    if props.get("delta.columnMapping.mode", "none").lower() not in {"", "none"}:
        found.add("columnMapping")
    return sorted(found)


def iceberg_readability(table_type: str, data_source_format: str, props: dict[str, str]) -> str:
    """How an Iceberg client reads the table: native, uniform, or none."""
    fmt = (data_source_format or "").upper()
    if fmt == "ICEBERG":
        return "native Iceberg"
    enabled = props.get("delta.universalFormat.enabledFormats", "")
    if "iceberg" in enabled.lower() or props.get("delta.enableIcebergCompatV2", "").lower() == "true":
        return "UniForm (Iceberg reads)"
    return "none"


def verdict(table_type: str, data_source_format: str, readability: str, features: list[str]) -> tuple[str, str]:
    """Portability verdict and the reason, from table type, format, Iceberg readability, and features."""
    table_type = (table_type or "").upper()
    fmt = (data_source_format or "").upper()
    if table_type in {"MATERIALIZED_VIEW", "STREAMING_TABLE"}:
        return REBUILD, "Refresh logic runs in Databricks. Export the defining query and recreate the pipeline."
    if table_type == "VIEW":
        return NEEDS_CHANGES, "A view holds a query, not files. Export the SQL and recreate it in the target."
    if table_type == "FOREIGN":
        return NEEDS_CHANGES, "Data lives in another system. Read it from there, not through Databricks."
    if table_type in SHALLOW_CLONE_TYPES:
        return NEEDS_CHANGES, "A shallow clone references the source table's files. Deep clone it before you export or retire the source."
    if readability != "none":
        return RUNS_AS_IS, f"Readable by Iceberg clients ({readability})."
    if fmt in {"PARQUET", "CSV", "JSON", "ORC", "AVRO", "TEXT"}:
        return RUNS_AS_IS, f"Plain {fmt.lower()} files that any engine reads."
    if fmt == "DELTA" and features:
        names = ", ".join(READER_FEATURES[f] for f in features)
        return NEEDS_CHANGES, f"Delta readers must support: {names}. Check your engine version, or drop the feature."
    if fmt == "DELTA":
        return RUNS_AS_IS, "Delta table with no reader-side features found. Any Delta reader opens it."
    return NEEDS_CHANGES, f"Format {fmt or 'unknown'} was not checked. Confirm the target engine reads it."


def inventory_row(
    catalog: str,
    schema: str,
    name: str,
    table_type: str,
    data_source_format: str,
    storage_path: str | None,
    props: dict[str, str],
    detail: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """One exit_inventory row. `detail` is the DESCRIBE DETAIL row as a dict, when available."""
    detail = detail or {}
    table_type = (table_type or "").upper()
    features = delta_features(props, list(detail.get("tableFeatures") or []))
    readability = iceberg_readability(table_type, data_source_format, props)
    result, reason = verdict(table_type, data_source_format, readability, features)
    if table_type in DERIVED_TYPES:
        placement = "n/a"
    elif table_type in {"EXTERNAL", "EXTERNAL_SHALLOW_CLONE"}:
        placement = "external"
    elif table_type == "FOREIGN":
        placement = "foreign"
    else:
        placement = "managed"
    location = detail.get("location") or storage_path
    size = detail.get("sizeInBytes")
    return {
        "table_name": f"{catalog}.{schema}.{name}",
        "table_type": table_type,
        "format": (data_source_format or "").upper() or None,
        "managed_or_external": placement,
        "iceberg_readability": readability,
        "reader_features": ", ".join(features) if features else None,
        "location": location,
        "size_bytes": int(size) if size is not None else None,
        "verdict": result,
        "reason": reason,
    }
