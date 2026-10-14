"""Shared helpers for the agent guides: spec loading, names, MCP and gateway calls, and small stats.

Everything here is pure Python so it can be unit tested without a workspace. Network helpers take a
`headers` dict (from `WorkspaceClient().config.authenticate()`), so calls use whatever OAuth identity
the job or serving endpoint runs as.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

import yaml

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
MCP_PROTOCOL_VERSION = "2025-06-18"


def load_spec(path: str) -> dict[str, Any]:
    with open(path) as handle:
        spec = yaml.safe_load(handle)
    validate_spec(spec)
    return spec


def validate_spec(spec: dict[str, Any]) -> None:
    names = [spec["data"]["table"], spec["tool"]["function"], spec["tool"]["parameter"]]
    names += [c["name"] for c in spec["data"]["columns"]]
    names += [s["name"] for s in spec["gateway"]["services"]]
    for name in names:
        if not _IDENT.match(name):
            raise ValueError(f"Not a valid identifier: {name}")
    services = {s["name"] for s in spec["gateway"]["services"]}
    if spec["gateway"]["burst_service"] not in services:
        raise ValueError("burst_service must name one of the gateway services")
    for col in spec["data"]["columns"]:
        if col["kind"] == "values" and len(col["values"]) != len(col["weights"]):
            raise ValueError(f"values and weights differ in length for {col['name']}")


def qualified(catalog: str, schema: str, name: str) -> str:
    return f"{catalog}.{schema}.{name}"


def mcp_tool_name(catalog: str, schema: str, function: str) -> str:
    """UC function tools are named catalog__schema__function."""
    return f"{catalog}__{schema}__{function}"


def mcp_url(host: str, catalog: str, schema: str) -> str:
    return f"{host.rstrip('/')}/api/2.0/mcp/functions/{catalog}/{schema}"


def parse_mcp_body(text: str) -> dict[str, Any]:
    """MCP servers answer with plain JSON or a single server-sent event; accept both."""
    text = text.strip()
    if text.startswith("{"):
        return json.loads(text)
    for line in text.splitlines():
        if line.startswith("data:"):
            return json.loads(line[5:].strip())
    raise ValueError("No JSON-RPC payload in MCP response")


def mcp_rpc(url: str, headers: dict[str, str], method: str, params: dict | None = None, rid: int = 1) -> tuple[dict, float]:
    """One JSON-RPC call to an MCP server. Returns the parsed body and the elapsed milliseconds."""
    import requests

    body = {"jsonrpc": "2.0", "id": rid, "method": method}
    if params is not None:
        body["params"] = params
    start = time.perf_counter()
    resp = requests.post(
        url,
        headers={**headers, "Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
        json=body,
        timeout=60,
    )
    elapsed = (time.perf_counter() - start) * 1000
    resp.raise_for_status()
    return parse_mcp_body(resp.text), elapsed


def tool_result_text(result: dict[str, Any]) -> str:
    """Flatten a tools/call result into the text a model reads."""
    if "error" in result:
        return f"ERROR: {result['error'].get('message', result['error'])}"
    content = result.get("result", {}).get("content", [])
    return "\n".join(part.get("text", "") for part in content if part.get("type") == "text")


def short_tool_name(full_name: str) -> str:
    """Chat APIs cap tool names at 64 characters; the function part of catalog__schema__function fits."""
    return full_name.rsplit("__", 1)[-1][:64]


def mcp_tools_as_chat_tools(tools: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Convert MCP tool definitions into OpenAI-style chat tools. Returns (tools, short name -> MCP name)."""
    aliases = {short_tool_name(t["name"]): t["name"] for t in tools}
    if len(aliases) != len(tools):
        raise ValueError("Tool names collide after shortening")
    chat_tools = [
        {
            "type": "function",
            "function": {
                "name": short_tool_name(t["name"]),
                "description": t.get("description", ""),
                "parameters": t.get("inputSchema", {"type": "object", "properties": {}}),
            },
        }
        for t in tools
    ]
    return chat_tools, aliases


def chat(host: str, headers: dict[str, str], model: str, messages: list[dict], tools: list[dict] | None = None,
         max_tokens: int = 400) -> tuple[int, dict[str, Any], float]:
    """POST to the Unity Gateway chat completions API. Returns (status, json body, elapsed ms)."""
    import requests

    payload: dict[str, Any] = {"model": model, "messages": messages, "max_tokens": max_tokens}
    if tools:
        payload["tools"] = tools
    start = time.perf_counter()
    resp = requests.post(f"{host.rstrip('/')}/ai-gateway/mlflow/v1/chat/completions", headers=headers, json=payload, timeout=120)
    elapsed = (time.perf_counter() - start) * 1000
    try:
        body = resp.json()
    except ValueError:
        body = {"raw": resp.text[:500]}
    return resp.status_code, body, elapsed


def message_of(body: dict[str, Any]) -> dict[str, Any]:
    return body["choices"][0]["message"]


def text_of(message: dict[str, Any]) -> str:
    """Message content as plain text. Some models return a list of parts, including reasoning blocks."""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
    return ""


def tool_calls_of(message: dict[str, Any]) -> list[dict[str, Any]]:
    return message.get("tool_calls") or []


def percentile(values: list[float], pct: float) -> float:
    """Nearest-rank percentile; 0.0 for an empty list."""
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, round(pct / 100 * len(ordered)))
    return float(ordered[min(rank, len(ordered)) - 1])


def summarize_latency(values: list[float]) -> dict[str, float]:
    return {
        "n": len(values),
        "p50_ms": round(percentile(values, 50), 1),
        "max_ms": round(max(values), 1) if values else 0.0,
    }


def status_counts(codes: list[int]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for code in codes:
        counts[str(code)] = counts.get(str(code), 0) + 1
    return counts


def routing_for(prefix_catalog: str, schema: str, name: str) -> str:
    """Model-service name callers pass as `model`."""
    return qualified(prefix_catalog, schema, name)


def to_bool(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}
