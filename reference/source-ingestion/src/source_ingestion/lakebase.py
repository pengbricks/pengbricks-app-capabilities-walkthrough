"""Connect to a Lakebase Postgres endpoint with an OAuth token from the Databricks SDK."""

from __future__ import annotations

from typing import Any


def endpoint_name(project: str, branch: str, endpoint: str) -> str:
    return f"projects/{project}/branches/{branch}/endpoints/{endpoint}"


def connection_settings(workspace: Any, project: str, branch: str, endpoint: str, database: str) -> dict[str, Any]:
    """Host, user, database, and a short-lived OAuth token (valid for about an hour)."""
    name = endpoint_name(project, branch, endpoint)
    host = workspace.postgres.get_endpoint(name=name).status.hosts.host
    token = workspace.postgres.generate_database_credential(endpoint=name).token
    return {
        "host": host,
        "port": 5432,
        "user": workspace.current_user.me().user_name,
        "password": token,
        "dbname": database,
        "sslmode": "require",
    }


def connect(settings: dict[str, Any]):
    import psycopg2

    return psycopg2.connect(**settings)
