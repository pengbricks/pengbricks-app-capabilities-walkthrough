"""Helpers for the Lakebase app development guide.

Naming, token timing, retry policy, connection strings, create-or-reuse decisions, and the SQL the
notebooks run are plain Python, so the unit tests need no workspace and no database. The two
functions that touch a database or the SDK (`make_pool`, `connect_with_retry`) import their clients
inside the function.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Iterator

# A new project starts with these. The bundle's default endpoint settings apply to the primary endpoint.
BRANCH = "production"
ENDPOINT = "primary"
DATABASE = "databricks_postgres"

IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
RESOURCE_ID = re.compile(r"^[a-z][a-z0-9-]{0,62}$")

TOKEN_LIFETIME_SECONDS = 3600  # Lakebase OAuth tokens last one hour
TOKEN_REFRESH_MARGIN_SECONDS = 120  # the docs refresh a token within 2 minutes of expiry

# Change types in a Lakebase Change Data Feed history table.
CHANGE_TYPES = ("insert", "update_preimage", "update_postimage", "delete")


def ident(name: str) -> str:
    """A schema, table, or column name that is safe to put in SQL."""
    if not isinstance(name, str) or not IDENTIFIER.match(name):
        raise ValueError(f"not a plain identifier: {name!r}")
    return name


def resource_id(name: str) -> str:
    """A project, branch, or endpoint ID: lowercase letters, digits, and hyphens, starting with a letter."""
    if not isinstance(name, str) or not RESOURCE_ID.match(name):
        raise ValueError(f"not a valid Lakebase resource ID: {name!r}")
    return name


# ---------- resource names ----------


def project_name(project: str) -> str:
    return f"projects/{resource_id(project)}"


def branch_name(project: str, branch: str) -> str:
    return f"{project_name(project)}/branches/{resource_id(branch)}"


def endpoint_name(project: str, branch: str, endpoint: str) -> str:
    return f"{branch_name(project, branch)}/endpoints/{resource_id(endpoint)}"


def ttl_text(hours: float) -> str:
    """A branch time-to-live in the seconds format the API takes, for example 3600s."""
    seconds = int(round(hours * 3600))
    if seconds < 1:
        raise ValueError("a branch ttl must be at least one second")
    return f"{seconds}s"


# ---------- token timing ----------


def token_needs_refresh(
    issued_at: float,
    now: float,
    lifetime: float = TOKEN_LIFETIME_SECONDS,
    margin: float = TOKEN_REFRESH_MARGIN_SECONDS,
) -> bool:
    """True when a token is inside the refresh margin of its expiry.

    Expiry is checked only at login, so an open connection keeps working. Code that holds a token
    and reuses it for new connections must call this before each one. A pool that mints a token for
    every new connection never needs it.
    """
    return now >= issued_at + lifetime - margin


def seconds_until_refresh(
    issued_at: float,
    now: float,
    lifetime: float = TOKEN_LIFETIME_SECONDS,
    margin: float = TOKEN_REFRESH_MARGIN_SECONDS,
) -> float:
    """Seconds left before `token_needs_refresh` turns true, never below zero."""
    return max(0.0, issued_at + lifetime - margin - now)


def pool_max_lifetime(token_lifetime: float = TOKEN_LIFETIME_SECONDS) -> float:
    """A pool connection lifetime that recycles connections well inside the 3-day server limit."""
    return min(1800.0, token_lifetime / 2)


# ---------- retry policy ----------


@dataclass(frozen=True)
class RetryPolicy:
    """Exponential backoff for the first query after scale to zero."""

    attempts: int = 6
    base_delay: float = 0.5
    factor: float = 2.0
    max_delay: float = 8.0

    def delays(self) -> Iterator[float]:
        """The wait before each retry. There is one fewer delay than attempts."""
        for index in range(max(self.attempts - 1, 0)):
            yield min(self.base_delay * self.factor**index, self.max_delay)

    def total_wait(self) -> float:
        return sum(self.delays())


WAKE_UP_PHRASES = (
    "the database system is starting up",
    "connection refused",
    "could not connect to server",
    "server closed the connection unexpectedly",
    "connection timeout expired",
    "timeout expired",
    "terminating connection",
    "connection is lost",
    "connection already closed",
)


def is_wake_up_error(error: BaseException) -> bool:
    """True for the errors a suspended or resuming compute produces. Authentication errors are not retried."""
    text = str(error).lower()
    if "password authentication failed" in text or "permission denied" in text or ("role" in text and "does not exist" in text):
        return False
    return any(phrase in text for phrase in WAKE_UP_PHRASES)


def retry_call(
    fn: Callable[[], Any],
    policy: RetryPolicy = RetryPolicy(),
    retryable: Callable[[BaseException], bool] = is_wake_up_error,
    sleep: Callable[[float], None] = time.sleep,
    on_retry: Callable[[int, float, BaseException], None] | None = None,
) -> Any:
    """Call `fn`, retrying errors that `retryable` accepts. The last error is raised."""
    delays = list(policy.delays())
    for attempt in range(policy.attempts):
        try:
            return fn()
        except Exception as error:  # noqa: BLE001 - the predicate decides what is retryable
            if attempt >= len(delays) or not retryable(error):
                raise
            if on_retry:
                on_retry(attempt + 1, delays[attempt], error)
            sleep(delays[attempt])
    raise RuntimeError("unreachable")


def wait_until(
    check: Callable[[], Any],
    done: Callable[[Any], bool],
    timeout: float,
    interval: float,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    failed: Callable[[Any], bool] = lambda value: False,
    what: str = "the condition",
) -> Any:
    """Poll `check` until `done(value)`. Raises if `failed(value)` or the timeout passes."""
    deadline = clock() + timeout
    while True:
        value = check()
        if done(value):
            return value
        if failed(value):
            raise RuntimeError(f"{what} failed: {value}")
        if clock() + interval > deadline:
            raise TimeoutError(f"{what} did not finish within {timeout:.0f} seconds; last value: {value}")
        sleep(interval)


# ---------- connection strings ----------


def conninfo(host: str, user: str, dbname: str = "databricks_postgres", port: int = 5432, sslmode: str = "require") -> str:
    """A libpq connection string without the password. A fresh OAuth token is the password."""
    for key, value in (("host", host), ("user", user), ("dbname", dbname)):
        if not value or re.search(r"\s", str(value)):
            raise ValueError(f"{key} must be a non-empty value without spaces: {value!r}")
    return f"dbname={dbname} user={user} host={host} port={port} sslmode={sslmode}"


def pooled_host(host: str) -> str:
    """The PgBouncer host for a read-write endpoint. It accepts password roles only, not OAuth tokens."""
    first, _, rest = host.partition(".")
    return host if first.endswith("-pooler") else f"{first}-pooler.{rest}"


# ---------- create or reuse ----------


def decide(existing_state: str | None, ready: Iterable[str], in_progress: Iterable[str] = (), broken: Iterable[str] = ()) -> str:
    """What a rerun does with a resource: create, wait, reuse, or recreate.

    `existing_state` is None when the resource does not exist. States are compared in upper case.
    """
    if existing_state is None:
        return "create"
    state = str(existing_state).upper()
    if state in {s.upper() for s in broken}:
        return "recreate"
    if state in {s.upper() for s in in_progress}:
        return "wait"
    if state in {s.upper() for s in ready}:
        return "reuse"
    return "wait"


SYNCED_READY = ("SYNCED_TABLE_ONLINE", "SYNCED_TABLE_ONLINE_NO_PENDING_UPDATE")
SYNCED_BROKEN = ("SYNCED_TABLE_OFFLINE_FAILED", "SYNCED_TABLE_ONLINE_PIPELINE_FAILED")


def synced_table_action(state: str | None) -> str:
    """create when missing, recreate when the pipeline failed, reuse when online, otherwise wait."""
    return decide(state, SYNCED_READY, broken=SYNCED_BROKEN)


def branch_action(state: str | None) -> str:
    """A dev branch of the same name is deleted and created again, so a rerun starts from production data."""
    if state is None:
        return "create"
    if str(state).upper() == "DELETED":
        return "create"
    return "recreate"


def cdf_action(configs: Iterable[dict[str, str]], postgres_schema: str) -> str:
    """A schema can have only one feed: reuse the config that covers it, create one otherwise."""
    return "reuse" if any(c.get("postgres_schema") == postgres_schema for c in configs) else "create"


def catalog_action(existing: bool) -> str:
    return "reuse" if existing else "create"


def cleanup_actions(cleanup: str, found: dict[str, bool]) -> list[str]:
    """The steps cleanup runs. Nothing runs unless cleanup is "delete", and only for things that exist."""
    if str(cleanup).strip().lower() != "delete":
        return []
    order = ["catalog", "synced_table", "cdf_config", "dev_branch", "delta_tables", "postgres_schemas"]
    return [step for step in order if found.get(step)]


# ---------- Change Data Feed ----------


def cdf_missing_changes(before: dict[str, int], after: dict[str, int], expected: Iterable[str] = CHANGE_TYPES[1:]) -> list[str]:
    """Change types in `expected` whose count has not grown since `before` was taken."""
    return [kind for kind in expected if after.get(kind, 0) <= before.get(kind, 0)]


def cdf_counts(rows: Iterable[Any]) -> dict[str, int]:
    """Count rows by _pg_change_type from (change_type, count) pairs."""
    counts = {kind: 0 for kind in CHANGE_TYPES}
    for kind, count in rows:
        counts[str(kind)] = counts.get(str(kind), 0) + int(count)
    return counts


def is_stable(readings: list[Any], needed: int = 3) -> bool:
    """True when the last `needed` readings are equal: the feed has flushed everything written so far."""
    return len(readings) >= needed and all(r == readings[-1] for r in readings[-needed:])


def cdf_ready_state(states: Iterable[str]) -> bool:
    """True when every table in the feed is streaming."""
    states = list(states)
    return bool(states) and all(str(s).endswith("STREAMING") for s in states)


# ---------- SQL ----------


def app_schema_sql(schema: str) -> list[str]:
    """DDL for the app schema and the orders table. Every statement is safe to run again."""
    s = ident(schema)
    return [
        f"CREATE SCHEMA IF NOT EXISTS {s}",
        f"""CREATE TABLE IF NOT EXISTS {s}.orders (
            order_id    integer PRIMARY KEY,
            customer    text NOT NULL,
            status      text NOT NULL DEFAULT 'new',
            amount      numeric(10, 2) NOT NULL,
            updated_at  timestamptz NOT NULL DEFAULT now()
        )""",
        f"ALTER TABLE {s}.orders REPLICA IDENTITY FULL",
    ]


def upsert_orders_sql(schema: str) -> str:
    """One statement for the sample rows. A rerun puts each row back to its starting values."""
    s = ident(schema)
    return (
        f"INSERT INTO {s}.orders (order_id, customer, status, amount) VALUES (%s, %s, %s, %s) "
        "ON CONFLICT (order_id) DO UPDATE SET "
        "customer = EXCLUDED.customer, status = EXCLUDED.status, amount = EXCLUDED.amount, updated_at = now()"
    )


SAMPLE_ORDERS = (
    (1001, "Northwind Traders", "new", 120.50),
    (1002, "Contoso Retail", "new", 89.99),
    (1003, "Fabrikam Supply", "packed", 450.00),
    (1004, "Adventure Works", "new", 15.25),
    (1005, "Tailspin Toys", "packed", 310.10),
)
# The orders that notebook 03 changes: one is updated, one is deleted.
UPDATED_ORDER_ID = 1002
DELETED_ORDER_ID = 1005

SAMPLE_PRODUCTS = (
    (1, "Standing desk", "furniture", 429.00, 14),
    (2, "Monitor arm", "accessories", 79.00, 60),
    (3, "Ergonomic chair", "furniture", 359.00, 8),
    (4, "USB-C dock", "accessories", 149.00, 35),
    (5, "Desk lamp", "lighting", 39.50, 120),
)

VECTOR_DIMENSIONS = 4
SAMPLE_DOCS = (
    (1, "Reset a forgotten password", [0.9, 0.1, 0.0, 0.1]),
    (2, "Change the billing address", [0.1, 0.9, 0.1, 0.0]),
    (3, "Track a delayed shipment", [0.0, 0.2, 0.9, 0.1]),
    (4, "Cancel an order before it ships", [0.1, 0.3, 0.8, 0.2]),
    (5, "Update payment method", [0.2, 0.9, 0.0, 0.1]),
)


def vector_literal(values: Iterable[float]) -> str:
    """The text form pgvector reads: [0.1,0.2]."""
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def vector_schema_sql(schema: str, dimensions: int = VECTOR_DIMENSIONS) -> list[str]:
    """pgvector setup. IF NOT EXISTS on the extension, the table, and the index makes a rerun a no-op."""
    s = ident(schema)
    if not 1 <= int(dimensions) <= 16000:
        raise ValueError("vector dimensions must be between 1 and 16000")
    return [
        "CREATE EXTENSION IF NOT EXISTS vector",
        f"CREATE SCHEMA IF NOT EXISTS {s}",
        f"CREATE TABLE IF NOT EXISTS {s}.docs (id integer PRIMARY KEY, body text NOT NULL, embedding vector({int(dimensions)}) NOT NULL)",
        f"CREATE INDEX IF NOT EXISTS docs_embedding_idx ON {s}.docs USING hnsw (embedding vector_cosine_ops)",
    ]


def upsert_docs_sql(schema: str) -> str:
    s = ident(schema)
    return (
        f"INSERT INTO {s}.docs (id, body, embedding) VALUES (%s, %s, %s::vector) "
        "ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, embedding = EXCLUDED.embedding"
    )


def nearest_sql(schema: str, limit: int = 3) -> str:
    s = ident(schema)
    return (
        f"SELECT id, body, embedding <=> %s::vector AS cosine_distance FROM {s}.docs "
        f"ORDER BY embedding <=> %s::vector LIMIT {int(limit)}"
    )


def delta_source_sql(table: str) -> list[str]:
    """The Delta source for the synced table. A primary key and a change feed are what Triggered mode needs."""
    return [
        f"""CREATE TABLE IF NOT EXISTS {table} (
            product_id INT NOT NULL,
            name STRING,
            category STRING,
            price DECIMAL(10, 2),
            stock INT,
            CONSTRAINT {table.split('.')[-1]}_pk PRIMARY KEY (product_id)
        ) TBLPROPERTIES (delta.enableChangeDataFeed = true)""",
        f"ALTER TABLE {table} SET TBLPROPERTIES (delta.enableChangeDataFeed = true)",
    ]


# ---------- clients (need a workspace and a database) ----------


def make_token_connection_class(mint_token: Callable[[], str]):
    """A psycopg Connection that asks `mint_token` for the password every time it opens a connection."""
    import psycopg

    class TokenConnection(psycopg.Connection):
        @classmethod
        def connect(cls, conninfo: str = "", **kwargs):
            kwargs["password"] = mint_token()
            return super().connect(conninfo, **kwargs)

    return TokenConnection


def make_pool(workspace: Any, endpoint: str, user: str, dbname: str = "databricks_postgres", max_size: int = 4):
    """A psycopg pool that mints an OAuth token for each new connection and checks one out only if it is alive."""
    from psycopg_pool import ConnectionPool

    host = workspace.postgres.get_endpoint(name=endpoint).status.hosts.host
    pool = ConnectionPool(
        conninfo=conninfo(host, user, dbname),
        connection_class=make_token_connection_class(lambda: workspace.postgres.generate_database_credential(endpoint=endpoint).token),
        min_size=1,
        max_size=max_size,
        max_lifetime=pool_max_lifetime(),
        check=ConnectionPool.check_connection,
        open=False,
    )
    pool.open(wait=False)
    return pool


def connect_with_retry(pool: Any, policy: RetryPolicy = RetryPolicy(), timeout: float = 30.0, sleep: Callable[[float], None] = time.sleep):
    """Wait for the pool's first connection. A suspended compute needs a few seconds to resume."""
    def attempt():
        pool.wait(timeout=timeout)
        with pool.connection(timeout=timeout) as conn:
            conn.execute("SELECT 1")
        return pool

    def report(number: int, delay: float, error: BaseException) -> None:
        print(f"Compute is waking up (attempt {number}): {str(error).splitlines()[0][:100]}. Retrying in {delay:.1f}s")

    # pool.wait raises PoolTimeout, whose text says "pool initialization incomplete".
    retryable = lambda error: is_wake_up_error(error) or "pool initialization incomplete" in str(error).lower()  # noqa: E731
    return retry_call(attempt, policy, retryable, sleep, report)


def find_database_path(workspace: Any, branch: str, postgres_database: str = "databricks_postgres") -> str:
    """The databases/<id> resource path of a Postgres database on a branch. Change Data Feed needs it."""
    for database in workspace.postgres.list_databases(parent=branch):
        status = database.status
        if status is not None and status.postgres_database == postgres_database:
            return database.name
    raise LookupError(f"no database named {postgres_database} on {branch}")


def require_project(workspace: Any, project: str) -> str:
    """Return the project ID after checking that the Lakebase project exists. Stops before anything changes."""
    from databricks.sdk.errors import NotFound

    try:
        workspace.postgres.get_project(name=project_name(project))
    except NotFound:
        raise RuntimeError(
            f"Lakebase project {project} does not exist. Run: databricks bundle deploy --target dev "
            "(the bundle creates the project). Nothing was changed."
        ) from None
    return project


def require_serverless_warehouse(workspace: Any, warehouse_id: str) -> str:
    """Return the warehouse ID after checking that it exists and is serverless. A registered Lakebase catalog needs one."""
    from databricks.sdk.errors import NotFound

    try:
        warehouse = workspace.warehouses.get(id=warehouse_id)
    except NotFound:
        warehouse = None
    if warehouse is None or not warehouse.enable_serverless_compute:
        raise RuntimeError(
            f"Warehouse {warehouse_id} is missing or not serverless. Run: databricks warehouses create --name lakebase-apps "
            "--cluster-size 2X-Small --warehouse-type PRO --enable-serverless-compute, then redeploy with "
            "--var warehouse_id=<new-id>. Nothing was changed."
        )
    return warehouse_id
