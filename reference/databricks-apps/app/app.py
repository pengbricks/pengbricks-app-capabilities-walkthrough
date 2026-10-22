"""Two routes that show the two identities a Databricks App can use.

/whoami/app  runs a query as the app service principal (app authorization).
/whoami/user runs the same query as the signed-in user, with the token the platform forwards in
             x-forwarded-access-token (user authorization, the `sql` scope).

The app has no state and creates no tables, so a redeploy or restart changes nothing. Both routes only read.
"""

import os
from typing import Optional

import uvicorn
from databricks.sdk import WorkspaceClient
from fastapi import FastAPI, Header
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI(title="Databricks Apps identity demo")

WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "")
SCHEMA_PATTERN = os.environ.get("SHARED_SCHEMA_PATTERN", "%capability_guides")

# information_schema only lists what the caller may see, so each identity gets its own answer.
QUERY = f"""
SELECT current_user() AS identity,
       (SELECT COUNT(*) FROM system.information_schema.tables
         WHERE table_schema LIKE '{SCHEMA_PATTERN}') AS visible_tables
"""


def run_query(client: WorkspaceClient) -> dict:
    result = client.statement_execution.execute_statement(warehouse_id=WAREHOUSE_ID, statement=QUERY, wait_timeout="50s")
    if result.status.state.value != "SUCCEEDED":
        message = result.status.error.message if result.status.error else result.status.state.value
        raise RuntimeError(message)
    identity, visible = result.result.data_array[0]
    return {"identity": identity, "visible_tables": int(visible)}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/whoami/app")
def whoami_app() -> JSONResponse:
    """Uses the credentials the platform injects for the app service principal."""
    try:
        return JSONResponse({"route": "app", "acts_as": "app service principal", **run_query(WorkspaceClient())})
    except Exception as error:  # report it; the health check reads this field
        return JSONResponse({"route": "app", "error": str(error)}, status_code=500)


@app.get("/whoami/user")
def whoami_user(x_forwarded_access_token: Optional[str] = Header(default=None)) -> JSONResponse:
    """Builds a client from the forwarded user token. The token is never stored or shared across requests."""
    if not x_forwarded_access_token:
        return JSONResponse({"route": "user", "error": "no x-forwarded-access-token header"}, status_code=401)
    try:
        # auth_type="pat" stops the SDK from also reading the app's own client id and secret from the environment.
        client = WorkspaceClient(token=x_forwarded_access_token, auth_type="pat")
        return JSONResponse({"route": "user", "acts_as": "signed-in user", **run_query(client)})
    except Exception as error:
        return JSONResponse({"route": "user", "error": str(error)}, status_code=500)


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return (
        "<h1>Databricks Apps identity demo</h1>"
        '<ul><li><a href="whoami/app">whoami/app</a>: query as the app service principal</li>'
        '<li><a href="whoami/user">whoami/user</a>: query as you, with your forwarded token</li>'
        '<li><a href="health">health</a></li></ul>'
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("DATABRICKS_APP_PORT", "8000")))
