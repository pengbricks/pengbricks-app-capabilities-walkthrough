"""Pure helpers for the SQL Connector step."""

from __future__ import annotations


def http_path(warehouse_id: str) -> str:
    return f"/sql/1.0/warehouses/{warehouse_id}"
