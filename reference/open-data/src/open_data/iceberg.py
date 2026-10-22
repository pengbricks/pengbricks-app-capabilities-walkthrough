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


def require_external_access(workspace, catalog: str | None = None, schema: str | None = None):
    """Return the workspace client after checking the metastore allows external data access. Stops before anything changes."""
    summary = workspace.metastores.summary()
    if summary.external_access_enabled is False:
        raise RuntimeError(
            "External data access is off on this metastore, so the Iceberg REST catalog refuses outside reads. "
            f"Run (metastore admin): databricks metastores update {summary.metastore_id} --external-access-enabled. "
            + (f"Then grant the reader: GRANT EXTERNAL USE SCHEMA ON SCHEMA {catalog}.{schema} TO `<principal>`. " if catalog and schema else "")
            + "Nothing was changed."
        )
    return workspace
