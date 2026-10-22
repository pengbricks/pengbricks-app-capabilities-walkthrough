"""Helpers for the Lakeflow Connect SQL Server guide: the source connection, the change batch, pipeline
updates, landing checks, the run log, and a small Genie client."""

from __future__ import annotations

import json
import time
import uuid
from decimal import Decimal
from typing import Any, Iterable

TABLES = {"customers": "lfc_customers", "orders": "lfc_orders", "products": "lfc_products"}
SILVER = {"orders": "lfc_silver_orders", "customers": "lfc_silver_customers", "plan_history": "lfc_silver_plan_history"}
PLANS = ["Basic", "Standard", "Premium"]
NEW_COLUMN = "loyalty_tier"


def fq(catalog: str, schema: str, table: str) -> str:
    return f"`{catalog}`.`{schema}`.`{table}`"


# ---------- source connection ----------


def connection_string(host: str, port: str | int, database: str, user: str, password: str) -> str:
    """ODBC-style string for mssql-python. TLS on, and the server certificate is validated."""
    return (
        f"Server=tcp:{host},{port};Database={database};Uid={user};Pwd={{{password.replace('}', '}}')}}};"
        "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    )


def source_settings(w: Any, connection_name: str) -> tuple[str, str]:
    """Host and port from the Unity Catalog connection, so they are set in one place."""
    options = w.connections.get(connection_name).options or {}
    return options["host"], options.get("port", "1433")


def connect(host: str, port: str | int, database: str, user: str, password: str) -> Any:
    import mssql_python

    connection = mssql_python.connect(connection_string(host, port, database, user, password))
    connection.autocommit = True
    return connection


def query(connection: Any, sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    cursor = connection.cursor()
    cursor.execute(sql, tuple(params))
    if cursor.description is None:
        return []
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


CAPTURE_SQL = """
SELECT t.name AS table_name, t.is_tracked_by_cdc AS cdc_on,
       CASE WHEN ct.object_id IS NULL THEN 0 ELSE 1 END AS change_tracking_on,
       (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0, 1)) AS row_count
FROM sys.tables t LEFT JOIN sys.change_tracking_tables ct ON ct.object_id = t.object_id
WHERE SCHEMA_NAME(t.schema_id) = ? AND t.name IN ('customers', 'orders', 'products')
ORDER BY t.name
"""

# What each table must have on the source for the SCD type the pipeline asks for.
EXPECTED_CAPTURE = {"customers": "cdc", "orders": "change_tracking", "products": "change_tracking"}


def capture_problems(rows: list[dict[str, Any]]) -> list[str]:
    """Tables whose change capture does not match the pipeline's SCD type. Empty means ready."""
    found = {row["table_name"]: row for row in rows}
    problems = []
    for table, capture in EXPECTED_CAPTURE.items():
        row = found.get(table)
        if row is None:
            problems.append(f"dbo.{table} is missing; run source/01_setup_source.sql")
            continue
        cdc, ct = bool(row["cdc_on"]), bool(row["change_tracking_on"])
        if capture == "cdc" and not cdc:
            problems.append(f"dbo.{table} needs CDC for SCD type 2 history")
        if capture == "cdc" and ct:
            problems.append(f"dbo.{table} has Change Tracking on too; the connector would use it and drop history")
        if capture == "change_tracking" and not (ct or cdc):
            problems.append(f"dbo.{table} has neither Change Tracking nor CDC")
    return problems


# ---------- the change batch ----------


def next_plan(plan: str) -> str:
    return PLANS[(PLANS.index(plan) + 1) % len(PLANS)]


# Each statement plays the application during a business day. Every run picks the rows least
# recently touched, so reruns change different rows and the source never runs out of candidates.
PICK_CUSTOMERS_SQL = """
SELECT TOP (?) customer_id, plan_name FROM dbo.customers
WHERE status = 'ACTIVE' ORDER BY updated_at, customer_id
"""
PICK_SHIP_SQL = "SELECT TOP (?) order_id FROM dbo.orders WHERE status = 'NEW' ORDER BY updated_at, order_id"
PICK_DELETE_SQL = "SELECT TOP (?) order_id FROM dbo.orders WHERE status = 'CANCELLED' ORDER BY updated_at, order_id"
UPDATE_PLAN_SQL = "UPDATE dbo.customers SET plan_name = ?, updated_at = SYSUTCDATETIME() WHERE customer_id = ?"
SHIP_SQL = "UPDATE dbo.orders SET status = 'SHIPPED', updated_at = SYSUTCDATETIME() WHERE order_id = ?"
DELETE_SQL = "DELETE FROM dbo.orders WHERE order_id = ?"
INSERT_ORDER_SQL = """
INSERT INTO dbo.orders (customer_id, product_id, quantity, amount, status, order_ts, updated_at)
OUTPUT inserted.order_id
SELECT ?, p.product_id, ?, ? * p.list_price, 'NEW', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM dbo.products p WHERE p.product_id = ?
"""
# Keeps a supply of cancelled orders for the next run's deletes.
CANCEL_SQL = "UPDATE dbo.orders SET status = 'CANCELLED', updated_at = SYSUTCDATETIME() WHERE order_id = ?"
PICK_CANCEL_SQL = "SELECT TOP (?) order_id FROM dbo.orders WHERE status = 'SHIPPED' ORDER BY updated_at, order_id"


def expectation(kind: str, table: str, key: int, column: str | None = None, value: Any = None) -> dict[str, Any]:
    return {"kind": kind, "source_table": table, "key": int(key), "column": column, "value": None if value is None else str(value)}


def make_changes(connection: Any, plan_changes: int = 3, inserts: int = 10, ships: int = 5, deletes: int = 2) -> list[dict[str, Any]]:
    """Insert, update, and delete on the source. Returns what bronze should show afterwards."""
    expected = []
    for row in query(connection, PICK_CUSTOMERS_SQL, [plan_changes]):
        new = next_plan(row["plan_name"])
        query(connection, UPDATE_PLAN_SQL, [new, row["customer_id"]])
        expected.append(expectation("update_history", "customers", row["customer_id"], "plan_name", new))
    customers = [row["customer_id"] for row in query(connection, PICK_CUSTOMERS_SQL, [inserts])]
    for i, customer_id in enumerate(customers):
        product_id, quantity = i % 12 + 1, i % 3 + 1
        inserted = query(connection, INSERT_ORDER_SQL, [customer_id, quantity, quantity, product_id])
        expected.append(expectation("insert", "orders", inserted[0]["order_id"], "status", "NEW"))
    for row in query(connection, PICK_SHIP_SQL, [ships]):
        query(connection, SHIP_SQL, [row["order_id"]])
        expected.append(expectation("update", "orders", row["order_id"], "status", "SHIPPED"))
    for row in query(connection, PICK_DELETE_SQL, [deletes]):
        query(connection, DELETE_SQL, [row["order_id"]])
        expected.append(expectation("delete", "orders", row["order_id"]))
    for row in query(connection, PICK_CANCEL_SQL, [deletes]):
        query(connection, CANCEL_SQL, [row["order_id"]])
        expected.append(expectation("update", "orders", row["order_id"], "status", "CANCELLED"))
    return expected


ADD_COLUMN_SQL = f"""
IF COL_LENGTH('dbo.customers', '{NEW_COLUMN}') IS NULL
    ALTER TABLE dbo.customers ADD {NEW_COLUMN} NVARCHAR(20) NULL
"""
SET_TIER_SQL = f"""
UPDATE dbo.customers SET {NEW_COLUMN} = CASE plan_name WHEN 'Premium' THEN 'Gold' WHEN 'Standard' THEN 'Silver' ELSE 'Bronze' END,
       updated_at = SYSUTCDATETIME()
OUTPUT inserted.customer_id, inserted.{NEW_COLUMN}
WHERE customer_id IN (SELECT TOP (?) customer_id FROM dbo.customers WHERE status = 'ACTIVE' ORDER BY customer_id)
"""


# ---------- landing checks ----------


def landing_sql(catalog: str, schema: str, expected: dict[str, Any]) -> str:
    """One query per expectation; it returns 1 when bronze shows the change."""
    table = fq(catalog, schema, TABLES[expected["source_table"]])
    key = "customer_id" if expected["source_table"] == "customers" else "order_id"
    k, col, val = expected["key"], expected["column"], expected["value"]
    if expected["kind"] == "delete":
        return f"SELECT CAST(count(*) = 0 AS INT) FROM {table} WHERE {key} = {k}"
    if expected["kind"] == "update_history":
        # The current version has the new value, and an earlier, closed version exists.
        return (
            f"SELECT CAST(count_if(__END_AT IS NULL AND CAST({col} AS STRING) = '{val}') = 1 "
            f"AND count_if(__END_AT IS NOT NULL) >= 1 AS INT) FROM {table} WHERE {key} = {k}"
        )
    current = " AND __END_AT IS NULL" if expected["source_table"] == "customers" else ""
    return f"SELECT CAST(count_if(CAST({col} AS STRING) = '{val}') = 1 AS INT) FROM {table} WHERE {key} = {k}{current}"


def landed(spark: Any, catalog: str, schema: str, expected: list[dict[str, Any]]) -> list[bool]:
    return [bool(spark.sql(landing_sql(catalog, schema, item)).first()[0]) for item in expected]


# ---------- pipeline updates ----------

DONE = {"COMPLETED", "FAILED", "CANCELED"}


def ensure_running(w: Any, pipeline_id: str, timeout_s: int = 1800) -> str:
    """Start the gateway if it is idle, and wait until it is running. Returns the pipeline state."""
    pipeline = w.pipelines.get(pipeline_id=pipeline_id)
    state = pipeline.state.value if pipeline.state else "IDLE"
    if state != "RUNNING":
        w.pipelines.start_update(pipeline_id=pipeline_id)
    started = time.time()
    while state != "RUNNING":
        if time.time() - started > timeout_s:
            raise TimeoutError(f"Gateway {pipeline_id} not running after {timeout_s}s (state {state})")
        time.sleep(20)
        pipeline = w.pipelines.get(pipeline_id=pipeline_id)
        state = pipeline.state.value if pipeline.state else "IDLE"
        latest = (pipeline.latest_updates or [None])[0]
        if latest and latest.state and latest.state.value == "FAILED":
            raise RuntimeError(f"Gateway {pipeline_id} update failed; open its event log")
    return state


def run_update(w: Any, pipeline_id: str, full_refresh_selection: list[str] | None = None, timeout_s: int = 3600) -> tuple[str, str]:
    """Start one update of a triggered pipeline and wait for it. Returns (update_id, final state)."""
    update_id = w.pipelines.start_update(pipeline_id=pipeline_id, full_refresh_selection=full_refresh_selection).update_id
    started = time.time()
    while True:
        state = w.pipelines.get_update(pipeline_id=pipeline_id, update_id=update_id).update.state.value
        if state in DONE:
            return update_id, state
        if time.time() - started > timeout_s:
            return update_id, "TIMEOUT"
        time.sleep(15)


def ingest_until(w: Any, pipeline_id: str, check, max_wait_s: int, pause_s: int = 60) -> dict[str, Any]:
    """Rerun the ingestion pipeline until check() returns True or max_wait_s passes.

    The gateway stages changes shortly after they commit, so the first update can miss the newest ones.
    """
    started, updates = time.time(), []
    while True:
        update_id, state = run_update(w, pipeline_id)
        updates.append({"update_id": update_id, "state": state})
        if state != "COMPLETED":
            raise RuntimeError(f"Ingestion update {update_id} ended {state}")
        if check():
            return {"ok": True, "updates": updates, "seconds": round(time.time() - started)}
        if time.time() - started + pause_s > max_wait_s:
            return {"ok": False, "updates": updates, "seconds": round(time.time() - started)}
        time.sleep(pause_s)


# ---------- run log ----------

RESULTS_TABLE = "lfc_results"


def write_results(spark: Any, catalog: str, schema: str, run_id: str, step: str, rows: list[tuple[str, float, str]]) -> None:
    """Replace this step's rows in the run log: (metric, value, detail)."""
    table = fq(catalog, schema, RESULTS_TABLE)
    spark.sql(
        f"CREATE TABLE IF NOT EXISTS {table} (run_id STRING, step STRING, metric STRING, value DOUBLE, detail STRING, recorded_at TIMESTAMP)"
    )
    spark.sql(f"DELETE FROM {table} WHERE step = '{step}'")
    if rows:
        frame = spark.createDataFrame(
            [(run_id, step, metric, float(value), detail) for metric, value, detail in rows],
            "run_id string, step string, metric string, value double, detail string",
        )
        from pyspark.sql import functions as F

        frame.withColumn("recorded_at", F.current_timestamp()).write.mode("append").saveAsTable(table)


# ---------- Genie ----------


def _stable_id(text: str) -> str:
    """A 32-character hex id that depends only on the text, so a rerun sends the same space definition."""
    return uuid.uuid5(uuid.NAMESPACE_URL, text).hex


def serialized_space(tables: list[str], instructions: str, sample_questions: list[str]) -> str:
    space: dict[str, Any] = {
        "version": 2,
        "data_sources": {"tables": [{"identifier": name} for name in sorted(tables)]},
        "config": {"sample_questions": sorted(({"id": _stable_id(q), "question": [q]} for q in sample_questions), key=lambda q: q["id"])},
        "instructions": {"text_instructions": [{"id": _stable_id(instructions), "content": [instructions]}]},
    }
    return json.dumps(space)


def upsert_space(w: Any, title: str, description: str, warehouse_id: str, serialized: str) -> str:
    """Update the space with this title, or create it."""
    found, token = [], None
    while True:
        page = w.api_client.do("GET", "/api/2.0/genie/spaces" + (f"?page_token={token}" if token else "")) or {}
        found += [s["space_id"] for s in page.get("spaces", []) if s.get("title") == title]
        token = page.get("next_page_token")
        if not token:
            break
    body = {"title": title, "description": description, "warehouse_id": warehouse_id, "serialized_space": serialized}
    if found:
        w.api_client.do("PATCH", f"/api/2.0/genie/spaces/{found[0]}", body=body)
        return found[0]
    return w.api_client.do("POST", "/api/2.0/genie/spaces", body=body)["space_id"]


def ask(w: Any, space_id: str, question: str, timeout_s: int = 300) -> dict[str, Any]:
    sent = w.api_client.do("POST", f"/api/2.0/genie/spaces/{space_id}/start-conversation", body={"content": question})
    path = f"/api/2.0/genie/spaces/{space_id}/conversations/{sent['conversation_id']}/messages/{sent['message_id']}"
    started = time.time()
    while True:
        message = w.api_client.do("GET", path)
        if message.get("status") in {"COMPLETED", "FAILED", "CANCELLED"} or time.time() - started > timeout_s:
            message["seconds"] = round(time.time() - started, 1)
            return message
        time.sleep(3)


def generated_sql(message: dict[str, Any]) -> str | None:
    for attachment in message.get("attachments") or []:
        if attachment.get("query"):
            return attachment["query"].get("query")
    return None


def same_answer(expected: list[tuple[Any, ...]], got: list[tuple[Any, ...]]) -> bool:
    """True when both results hold the same rows, ignoring row order, column order, and column names.

    Numbers are compared rounded to cents, everything else as text.
    """
    def cell(value: Any) -> str:
        if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
            return f"{float(value):.2f}"
        return "" if value is None else str(value)

    def rows(result: list[tuple[Any, ...]]) -> list[tuple[str, ...]]:
        return sorted(tuple(sorted(cell(v) for v in row)) for row in result)

    return bool(got) and rows(expected) == rows(got)
