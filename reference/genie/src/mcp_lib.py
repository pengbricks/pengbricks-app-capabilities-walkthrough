"""Helpers for the Genie external AI guide: MCP endpoint URLs, tool discovery, answer parsing, and a results table.

Everything here is pure Python except `write_rows`, so the tests run without a workspace. The tool names of the Genie Agent
MCP server are not listed in the public docs, so the code picks tools from the server's own `tools/list` response.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

from genie_lib import sql_str

RESULTS_TABLE = "genie_external_ai_results"
RESULTS_SCHEMA = "run_id string, step string, item string, value string, detail string, recorded_at string"
GUIDE = "genie-external-ai"

# Managed MCP servers, from docs.databricks.com/aws/en/agents/mcp-tools
GENIE_ONE_PATH = "/ai-gateway/mcp-services/system.ai.genie_one_mcp"  # generally available, scope ai-gateway
GENIE_AGENT_PATH = "/api/2.0/mcp/genie"  # + /<genie-space-id>, preview, scope genie, skips Unity Gateway
SERVERS = ("genie_agent", "genie_one")

T = TypeVar("T")


def call_sync(fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """Call a blocking function that runs `asyncio.run` inside, even when this thread already has a running event loop.

    `DatabricksMCPClient.list_tools()` and `call_tool()` (databricks-mcp, `mcp.py`) each call `asyncio.run(...)`. That raises
    `RuntimeError: asyncio.run() cannot be called from a running event loop` in a notebook, where IPython keeps a loop
    running. A fresh worker thread has no loop, so the call runs there and this thread waits for the result. With no running
    loop, `fn` is called directly. Exceptions from `fn` propagate unchanged.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return fn(*args, **kwargs)
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(fn, *args, **kwargs).result()


def normalize_host(host: str) -> str:
    """https://host with no trailing slash, whether the input has a scheme or not."""
    host = host.strip().rstrip("/")
    if not host:
        raise ValueError("workspace host is empty")
    return host if host.startswith("https://") else "https://" + host.removeprefix("http://")


def mcp_url(server: str, host: str, space_id: str = "") -> str:
    """The MCP endpoint for `genie_agent` (needs the agent ID) or `genie_one`."""
    base = normalize_host(host)
    if server == "genie_one":
        return base + GENIE_ONE_PATH
    if server == "genie_agent":
        if not space_id:
            raise ValueError("genie_agent needs a Genie Agent ID")
        return f"{base}{GENIE_AGENT_PATH}/{space_id}"
    raise ValueError(f"server must be one of {SERVERS}, got {server!r}")


def oauth_scope(server: str) -> str:
    return "ai-gateway" if server == "genie_one" else "genie"


def tool_field(tool: Any, name: str) -> Any:
    return tool.get(name) if isinstance(tool, dict) else getattr(tool, name, None)


def classify_tools(tools: list[Any]) -> dict[str, str | None]:
    """Pick the ask, poll, and result tools by name. `genie_ask` and `genie_poll_response` are documented for Genie One.

    For the Genie Agent server, an ask tool is any tool whose name has `ask` or `query` and not `poll` or `result`.
    """
    names = [tool_field(tool, "name") for tool in tools if tool_field(tool, "name")]

    def first(test: Callable[[str], bool]) -> str | None:
        return next((name for name in names if test(name.lower())), None)

    return {
        "ask": first(lambda n: ("ask" in n or "query" in n) and "poll" not in n and "result" not in n and "view" not in n),
        "poll": first(lambda n: "poll" in n),
        "result": first(lambda n: "result" in n and "poll" not in n),
    }


def schema_properties(tool: Any) -> dict[str, Any]:
    schema = tool_field(tool, "inputSchema") or {}
    return dict(schema.get("properties") or {})


def required_string_field(tool: Any) -> str | None:
    """The argument that carries the question: the first required string property, else the first string property."""
    schema = tool_field(tool, "inputSchema") or {}
    properties = schema.get("properties") or {}
    strings = [name for name, spec in properties.items() if (spec or {}).get("type") == "string"]
    required = [name for name in schema.get("required") or [] if name in strings]
    return (required or strings or [None])[0]


def ask_arguments(tool: Any, question: str) -> dict[str, Any]:
    field = required_string_field(tool)
    if field is None:
        raise ValueError(f"tool {tool_field(tool, 'name')} has no string argument for the question")
    return {field: question}


def follow_up_arguments(tool: Any, ids: dict[str, Any]) -> dict[str, Any]:
    """Arguments for a poll or result call: pass each ID the tool's schema names, from the ask response."""
    properties = schema_properties(tool)
    args = {key: value for key, value in ids.items() if key in properties and value}
    if "message_id" in properties and "message_id" not in args and ids.get("response_id"):
        args["message_id"] = ids["response_id"]
    return args


def content_text(result: Any) -> str:
    """All text blocks of an MCP CallToolResult (object or dict), joined."""
    content = tool_field(result, "content") or []
    parts = []
    for block in content:
        text = tool_field(block, "text")
        if text:
            parts.append(str(text))
    return "\n".join(parts)


def parse_json(text: str) -> Any:
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return None


def find_values(data: Any, keys: set[str]) -> list[Any]:
    """Every value stored under one of `keys`, searching nested dicts and lists."""
    found: list[Any] = []
    if isinstance(data, dict):
        for key, value in data.items():
            if key.lower() in keys and value not in (None, "", [], {}):
                found.append(value)
            found += find_values(value, keys)
    elif isinstance(data, list):
        for item in data:
            found += find_values(item, keys)
    return found


_FENCE = re.compile(r"```(?:sql)?\s*(.+?)```", re.IGNORECASE | re.DOTALL)
_SELECT = re.compile(r"\b(WITH|SELECT)\b.+", re.IGNORECASE | re.DOTALL)
_ID_KEYS = ("conversation_id", "response_id", "message_id", "statement_id")
_DONE = {"COMPLETED", "FAILED", "CANCELLED", "ERROR", "QUERY_RESULT_EXPIRED"}


def extract_ids(text: str) -> dict[str, Any]:
    data = parse_json(text)
    ids: dict[str, Any] = {}
    for key in _ID_KEYS:
        values = find_values(data, {key}) if data is not None else []
        if values and isinstance(values[0], (str, int)):
            ids[key] = values[0]
    return ids


def extract_status(text: str) -> str | None:
    values = find_values(parse_json(text), {"status", "state"})
    return str(values[0]).upper() if values and isinstance(values[0], (str, int)) else None


def is_done(status: str | None) -> bool:
    return status in _DONE


def extract_sql(text: str) -> str | None:
    """The generated SQL: a `query`/`sql` field if the reply is JSON, else a fenced block, else a bare SELECT."""
    data = parse_json(text)
    for value in find_values(data, {"sql", "query", "statement"}) if data is not None else []:
        if isinstance(value, dict):
            inner = find_values(value, {"query", "sql"})
            value = inner[0] if inner else None
        if isinstance(value, list):
            value = "".join(str(line) for line in value)
        if isinstance(value, str) and _SELECT.search(value):
            return value.strip()
    fenced = _FENCE.search(text or "")
    if fenced and _SELECT.search(fenced.group(1)):
        return fenced.group(1).strip()
    bare = _SELECT.search(text or "")
    return bare.group(0).strip() if bare and not text.lstrip().startswith("{") else None


def extract_answer(text: str) -> str:
    """The prose answer: description, answer, text, or content fields if JSON, else the reply text without the SQL block."""
    data = parse_json(text)
    if data is not None:
        for value in find_values(data, {"answer", "description", "text", "content", "message"}):
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, list) and all(isinstance(item, str) for item in value):
                return " ".join(value).strip()
        return ""
    return _FENCE.sub("", text or "").strip()


def poll_until_done(
    fetch: Callable[[], str],
    attempts: int,
    pause_seconds: float,
    sleep: Callable[[float], None] = time.sleep,
) -> tuple[str, int]:
    """Call `fetch` (a poll tool call that returns reply text) until the status is final. Returns (last text, polls used).

    The docs say to wait for one poll to finish before sending the next, so this never overlaps calls.
    """
    text = ""
    for poll in range(1, attempts + 1):
        text = fetch()
        if is_done(extract_status(text)):
            return text, poll
        if poll < attempts:
            sleep(pause_seconds)
    return text, attempts


def result_row(run_id: str, step: str, item: str, value: Any, detail: Any = "") -> tuple[str, ...]:
    return (run_id, step, item, str(value), str(detail), datetime.now(timezone.utc).isoformat())


def write_rows(spark: Any, base: str, step: str, rows: list[tuple[str, ...]]) -> None:
    """Replace one step's rows, so a rerun keeps the table at the same size."""
    spark.sql(f"CREATE TABLE IF NOT EXISTS {base}.{RESULTS_TABLE} ({RESULTS_SCHEMA})")
    spark.sql(f"DELETE FROM {base}.{RESULTS_TABLE} WHERE step = {sql_str(step)}")
    if rows:
        spark.createDataFrame(rows, RESULTS_SCHEMA).write.mode("append").saveAsTable(f"{base}.{RESULTS_TABLE}")


def pick_reusable_space(candidates: list[tuple[str, bool]]) -> str | None:
    """From (space_id, still_exists) pairs in priority order, the first agent that still exists."""
    return next((space_id for space_id, exists in candidates if exists), None)


def audit_sql(space_id: str, since_iso: str) -> str:
    """Statements the Genie Agent ran for this MCP session, from system.query.history."""
    return f"""
SELECT executed_by, executed_as, compute.warehouse_id AS warehouse_id, client_application, execution_status, CAST(start_time AS STRING) AS start_time
FROM system.query.history
WHERE query_source.genie_space_id = {sql_str(space_id)} AND start_time >= TIMESTAMP {sql_str(since_iso)}
ORDER BY start_time
""".strip()


def gateway_usage_sql(service_name: str = "system.ai.genie_one_mcp") -> str:
    """Gateway MCP calls by tool, from the query in the Govern an MCP docs."""
    return f"""
SELECT mcp_metadata.tool_name AS tool_name, COUNT(*) AS calls
FROM system.ai_gateway.usage
WHERE service_type = 'MCP_SERVICE' AND service_name = {sql_str(service_name)}
GROUP BY mcp_metadata.tool_name
ORDER BY calls DESC
""".strip()
