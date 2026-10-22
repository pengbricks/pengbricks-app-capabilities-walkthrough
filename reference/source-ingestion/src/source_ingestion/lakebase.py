"""Connect to a Lakebase Postgres endpoint with an OAuth token from the Databricks SDK."""

from __future__ import annotations

from typing import Any


def endpoint_name(project: str, branch: str, endpoint: str) -> str:
    return f"projects/{project}/branches/{branch}/endpoints/{endpoint}"


def require_endpoint(workspace: Any, name: str) -> Any:
    """Return the endpoint after checking the Lakebase project exists. Stops before anything changes."""
    from databricks.sdk.errors import NotFound

    try:
        return workspace.postgres.get_endpoint(name=name)
    except NotFound:
        project = name.split("/")[1]
        raise RuntimeError(
            f"Lakebase endpoint {name} does not exist. Run: databricks postgres create-project {project} "
            "(a new project starts with the production branch, the databricks_postgres database and the primary endpoint), "
            "or pass the ID of an existing project as the lakebase_project variable. Nothing was changed."
        ) from None


def connection_settings(workspace: Any, project: str, branch: str, endpoint: str, database: str) -> dict[str, Any]:
    """Host, user, database, and a short-lived OAuth token (valid for about an hour)."""
    name = endpoint_name(project, branch, endpoint)
    host = require_endpoint(workspace, name).status.hosts.host
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
