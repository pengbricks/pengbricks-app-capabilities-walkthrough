"""Workspace API helpers for the Unity Catalog and EDM guide.

They take a WorkspaceClient (or a stand-in with the same methods), so tests run with fakes.
"""

from __future__ import annotations


def table_object(full_name: str):
    from databricks.sdk.service.catalog import ExternalLineageObject, ExternalLineageTable

    return ExternalLineageObject(table=ExternalLineageTable(name=full_name))


def external_object(name: str):
    from databricks.sdk.service.catalog import ExternalLineageExternalMetadata, ExternalLineageObject

    return ExternalLineageObject(external_metadata=ExternalLineageExternalMetadata(name=name))


def lineage_object(ref: dict):
    """Build a lineage endpoint from {'table': full_name} or {'external': name}."""
    return table_object(ref["table"]) if "table" in ref else external_object(ref["external"])


def related_names(w, ref: dict, direction) -> set[str]:
    """Names of the tables and external objects related to `ref` in one direction."""
    names: set[str] = set()
    for info in w.external_lineage.list_external_lineage_relationships(object_info=lineage_object(ref), lineage_direction=direction):
        if info.table_info is not None:
            t = info.table_info
            names.add(".".join(p for p in (t.catalog_name, t.schema_name, t.name) if p))
        if info.external_metadata_info is not None:
            names.add(info.external_metadata_info.name)
    return names


def ref_name(ref: dict) -> str:
    return ref.get("table") or ref["external"]
