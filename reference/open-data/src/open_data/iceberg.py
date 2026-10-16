"""Pure helpers for the Iceberg guide."""

from __future__ import annotations


def catalog_properties(host: str, catalog: str, irc_path: str, token: str) -> dict[str, str]:
    return {
        "type": "rest",
        "uri": host.rstrip("/") + irc_path,
        "warehouse": catalog,
        "token": token,
        "header.X-Iceberg-Access-Delegation": "vended-credentials",
    }
