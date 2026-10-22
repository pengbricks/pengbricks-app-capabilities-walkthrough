from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from mcp_lib import (  # noqa: E402
    ask_arguments,
    audit_sql,
    classify_tools,
    content_text,
    extract_answer,
    extract_ids,
    extract_sql,
    extract_status,
    follow_up_arguments,
    gateway_usage_sql,
    mcp_url,
    normalize_host,
    oauth_scope,
    pick_reusable_space,
    poll_until_done,
)

GENIE_ONE_TOOLS = [
    {"name": "genie_ask", "inputSchema": {"type": "object", "properties": {"question": {"type": "string"}}, "required": ["question"]}},
    {"name": "genie_poll_response", "inputSchema": {"properties": {"conversation_id": {"type": "string"}, "response_id": {"type": "string"}}}},
    {"name": "genie_get_query_result", "inputSchema": {"properties": {"conversation_id": {"type": "string"}}}},
    {"name": "genie_cancel_response", "inputSchema": {}},
    {"name": "view_ask", "inputSchema": {}},
]


def test_hosts_get_https_and_no_trailing_slash() -> None:
    assert normalize_host("adb-1.azuredatabricks.net/") == "https://adb-1.azuredatabricks.net"
    assert normalize_host("http://host") == "https://host"
    with pytest.raises(ValueError):
        normalize_host(" ")


def test_endpoint_urls_follow_the_docs() -> None:
    assert mcp_url("genie_one", "host") == "https://host/ai-gateway/mcp-services/system.ai.genie_one_mcp"
    assert mcp_url("genie_agent", "https://host/", "abc123") == "https://host/api/2.0/mcp/genie/abc123"
    with pytest.raises(ValueError):
        mcp_url("genie_agent", "host")
    with pytest.raises(ValueError):
        mcp_url("sql", "host")


def test_scope_matches_the_endpoint() -> None:
    assert oauth_scope("genie_one") == "ai-gateway"
    assert oauth_scope("genie_agent") == "genie"


def test_genie_one_tools_are_classified() -> None:
    picked = classify_tools(GENIE_ONE_TOOLS)
    assert picked == {"ask": "genie_ask", "poll": "genie_poll_response", "result": "genie_get_query_result"}


def test_agent_tools_with_other_names_are_classified() -> None:
    tools = [SimpleNamespace(name="query_space_x", inputSchema={}), SimpleNamespace(name="poll_response_x", inputSchema={})]
    assert classify_tools(tools) == {"ask": "query_space_x", "poll": "poll_response_x", "result": None}


def test_question_goes_in_the_required_string_argument() -> None:
    tool = {"name": "t", "inputSchema": {"properties": {"limit": {"type": "integer"}, "q": {"type": "string"}}, "required": ["q"]}}
    assert ask_arguments(tool, "How many?") == {"q": "How many?"}
    with pytest.raises(ValueError):
        ask_arguments({"name": "t", "inputSchema": {}}, "x")


def test_follow_up_passes_only_ids_the_schema_names() -> None:
    ids = {"conversation_id": "c1", "response_id": "r1", "statement_id": "s1"}
    assert follow_up_arguments(GENIE_ONE_TOOLS[1], ids) == {"conversation_id": "c1", "response_id": "r1"}
    assert follow_up_arguments(GENIE_ONE_TOOLS[2], ids) == {"conversation_id": "c1"}


def test_json_reply_yields_ids_status_sql_and_answer() -> None:
    reply = json.dumps(
        {
            "conversation_id": "c1",
            "response_id": "r1",
            "status": "completed",
            "attachments": [{"query": {"query": "SELECT region, SUM(x) FROM t GROUP BY 1", "description": "Revenue by region"}}],
        }
    )
    assert extract_ids(reply) == {"conversation_id": "c1", "response_id": "r1"}
    assert extract_status(reply) == "COMPLETED"
    assert extract_sql(reply).startswith("SELECT region")
    assert extract_answer(reply) == "Revenue by region"


def test_plain_text_reply_with_a_fenced_query() -> None:
    reply = "Revenue is highest in EMEA.\n```sql\nSELECT 1 AS one\n```"
    assert extract_sql(reply) == "SELECT 1 AS one"
    assert extract_answer(reply) == "Revenue is highest in EMEA."
    assert extract_status(reply) is None


def test_reply_without_sql_returns_none() -> None:
    assert extract_sql('{"status": "COMPLETED", "text": "Which period do you want?"}') is None
    assert extract_answer('{"text": "Which period do you want?"}') == "Which period do you want?"


def test_content_text_joins_text_blocks_from_objects_and_dicts() -> None:
    result = SimpleNamespace(content=[SimpleNamespace(text="a"), {"text": "b"}, SimpleNamespace(text=None)])
    assert content_text(result) == "a\nb"


def test_poll_stops_when_the_status_is_final_and_never_overlaps() -> None:
    replies = iter(['{"status": "EXECUTING_QUERY"}', '{"status": "COMPLETED"}', '{"status": "COMPLETED"}'])
    sleeps: list[float] = []
    text, polls = poll_until_done(lambda: next(replies), attempts=5, pause_seconds=2, sleep=sleeps.append)
    assert polls == 2 and "COMPLETED" in text and sleeps == [2]


def test_poll_gives_up_after_the_attempts() -> None:
    text, polls = poll_until_done(lambda: '{"status": "RUNNING"}', attempts=3, pause_seconds=0, sleep=lambda _: None)
    assert polls == 3 and "RUNNING" in text


def test_reuse_picks_the_first_agent_that_still_exists() -> None:
    assert pick_reusable_space([("a", False), ("b", True), ("c", True)]) == "b"
    assert pick_reusable_space([("a", False)]) is None


def test_audit_queries_use_documented_columns() -> None:
    sql = audit_sql("abc'1", "2026-10-22T10:00:00+00:00")
    assert "genie_space_id = 'abc''1'" in sql and "executed_as" in sql
    usage = gateway_usage_sql()
    assert "service_type = 'MCP_SERVICE'" in usage and "mcp_metadata.tool_name" in usage
