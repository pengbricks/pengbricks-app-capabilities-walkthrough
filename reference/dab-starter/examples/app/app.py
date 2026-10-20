"""Serves the last 14 days of revenue from the dab-starter gold table as an HTML table.

The bundle sets WAREHOUSE_ID (from the attached warehouse), TABLE, and DATABRICKS_APP_PORT. The SDK
signs in as the app's service principal; nothing here holds a credential.
"""

import html
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from databricks.sdk import WorkspaceClient

client = WorkspaceClient()
QUERY = f"SELECT * FROM {os.environ['TABLE']} ORDER BY order_date DESC LIMIT 14"


def revenue_rows() -> tuple[list[str], list[list[str]]]:
    result = client.statement_execution.execute_statement(
        warehouse_id=os.environ["WAREHOUSE_ID"], statement=QUERY, wait_timeout="30s"
    )
    columns = [column.name for column in result.manifest.schema.columns]
    return columns, result.result.data_array or []


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        columns, rows = revenue_rows()
        header = "".join(f"<th>{html.escape(name)}</th>" for name in columns)
        body = "".join("<tr>" + "".join(f"<td>{html.escape(str(cell))}</td>" for cell in row) + "</tr>" for row in rows)
        page = f"<h1>Daily revenue</h1><table><tr>{header}</tr>{body}</table>"
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(page.encode())


HTTPServer(("0.0.0.0", int(os.environ.get("DATABRICKS_APP_PORT", "8000"))), Handler).serve_forever()
