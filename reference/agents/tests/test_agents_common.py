import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import agents_common as ac  # noqa: E402

SPEC = Path(__file__).resolve().parents[1] / "use_cases" / "general.yml"


def test_spec_loads_and_validates():
    spec = ac.load_spec(str(SPEC))
    assert spec["data"]["rows"] == 500
    assert {s["name"] for s in spec["gateway"]["services"]} >= {spec["gateway"]["burst_service"]}


def test_validate_rejects_bad_identifier():
    spec = ac.load_spec(str(SPEC))
    spec["tool"]["function"] = "bad name; drop"
    with pytest.raises(ValueError):
        ac.validate_spec(spec)


def test_validate_rejects_unknown_burst_service():
    spec = ac.load_spec(str(SPEC))
    spec["gateway"]["burst_service"] = "missing"
    with pytest.raises(ValueError):
        ac.validate_spec(spec)


def test_validate_rejects_weight_mismatch():
    spec = ac.load_spec(str(SPEC))
    spec["data"]["columns"][0]["weights"] = [1]
    with pytest.raises(ValueError):
        ac.validate_spec(spec)


def test_parse_mcp_body_plain_and_sse():
    payload = {"jsonrpc": "2.0", "id": 1, "result": {"tools": []}}
    assert ac.parse_mcp_body(json.dumps(payload)) == payload
    assert ac.parse_mcp_body("event: message\ndata: " + json.dumps(payload) + "\n\n") == payload
    with pytest.raises(ValueError):
        ac.parse_mcp_body("event: ping")


def test_tool_naming_and_url():
    assert ac.mcp_tool_name("c", "s", "f") == "c__s__f"
    assert ac.mcp_url("https://h.example/", "c", "s") == "https://h.example/api/2.0/mcp/functions/c/s"


def test_tool_result_text_handles_error_and_content():
    ok = {"result": {"content": [{"type": "text", "text": "a"}, {"type": "image"}, {"type": "text", "text": "b"}]}}
    assert ac.tool_result_text(ok) == "a\nb"
    assert ac.tool_result_text({"error": {"message": "denied"}}) == "ERROR: denied"


def test_mcp_tools_as_chat_tools():
    long_name = "c__" + "s" * 60 + "__fn"
    tools, aliases = ac.mcp_tools_as_chat_tools([{"name": long_name, "description": "d", "inputSchema": {"type": "object", "properties": {}}}])
    assert tools[0]["function"]["name"] == "fn" and tools[0]["type"] == "function"
    assert aliases == {"fn": long_name}
    assert len(tools[0]["function"]["name"]) <= 64


def test_tool_name_collision_is_rejected():
    with pytest.raises(ValueError):
        ac.mcp_tools_as_chat_tools([{"name": "a__s__f"}, {"name": "b__s__f"}])


def test_percentile_and_summary():
    assert ac.percentile([], 50) == 0.0
    assert ac.percentile([5, 1, 3], 50) == 3
    assert ac.summarize_latency([100.0, 300.0, 200.0]) == {"n": 3, "p50_ms": 200.0, "max_ms": 300.0}
    assert ac.summarize_latency([]) == {"n": 0, "p50_ms": 0.0, "max_ms": 0.0}


def test_status_counts_and_bool():
    assert ac.status_counts([200, 429, 200]) == {"200": 2, "429": 1}
    assert ac.to_bool("True") and not ac.to_bool("no")


def test_tool_calls_of_missing_key():
    assert ac.tool_calls_of({"content": "x"}) == []


def test_text_of_handles_string_list_and_missing():
    assert ac.text_of({"content": "hi"}) == "hi"
    parts = [{"type": "reasoning", "text": "hidden"}, {"type": "text", "text": "a"}, {"type": "text", "text": "b"}]
    assert ac.text_of({"content": parts}) == "ab"
    assert ac.text_of({"content": None}) == ""
