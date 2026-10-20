"""Helpers shared by the Genie guide tasks: spec loading, space payloads, answer comparison, and a thin Conversation API client."""

from __future__ import annotations

import json
import re
import time
import uuid
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

import yaml


# ---------- spec ----------


def load_spec(path: str | Path) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as handle:
        spec = yaml.safe_load(handle)
    names = [table["name"] for table in spec["tables"]]
    if len(names) != len(set(names)):
        raise ValueError("duplicate table names in spec")
    return spec


def fill(text: str, catalog: str, schema: str) -> str:
    return text.replace("{catalog}", catalog).replace("{schema}", schema)


def fill_deep(value: Any, catalog: str, schema: str) -> Any:
    if isinstance(value, str):
        return fill(value, catalog, schema)
    if isinstance(value, list):
        return [fill_deep(item, catalog, schema) for item in value]
    if isinstance(value, dict):
        return {key: fill_deep(item, catalog, schema) for key, item in value.items()}
    return value


def metric_view_yaml(spec: dict[str, Any], catalog: str, schema: str) -> str:
    definition = fill_deep(spec["metric_view"]["definition"], catalog, schema)
    # keep the version a string so the YAML reads `version: '1.1'` rather than a float
    definition["version"] = str(definition["version"])
    return yaml.safe_dump(definition, sort_keys=False, width=1000)


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


# ---------- answer comparison ----------


def normalize_cell(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, Decimal)):
        return round(float(value), 2)
    text = str(value).strip().lower()
    try:
        return round(float(text), 2)
    except ValueError:
        return text


def normalize_rows(rows: list[Any]) -> list[tuple[Any, ...]]:
    return [tuple(normalize_cell(cell) for cell in row) for row in rows]


def rows_match(expected: list[Any], got: list[Any]) -> bool:
    """True when both results have the same number of rows and every expected row's values appear in a distinct returned row.

    Column names and order are ignored, and extra returned columns are allowed, so a correct answer is not marked wrong
    for naming. A code such as "NA" instead of "North America" does not match.
    """
    want = normalize_rows(expected)
    have = normalize_rows(got)
    if len(want) != len(have):
        return False
    remaining = list(have)
    for row in sorted(want, key=repr):
        needed = Counter(row)
        for index, candidate in enumerate(remaining):
            if not needed - Counter(candidate):
                del remaining[index]
                break
        else:
            return False
    return True


# ---------- user-experience log ----------


def find_issues(
    status: str,
    has_sql: bool,
    matches: bool | None,
    latency_s: float,
    latency_warn_s: float,
    ambiguous: bool = False,
    expects_sql: bool = True,
    response_text: str = "",
) -> list[str]:
    issues: list[str] = []
    if status != "COMPLETED":
        issues.append(f"Message ended as {status}")
    elif expects_sql and not has_sql:
        issues.append("Answered in text only, no SQL to check")
    if matches is False:
        issues.append("Result differs from the expected answer")
    if ambiguous and has_sql:
        issues.append("Ambiguous request answered with a guessed definition and no clarifying question")
    if ambiguous and not has_sql and status == "COMPLETED" and "?" in response_text:
        issues.append("Genie asked a clarifying question instead of answering")
    if latency_s > latency_warn_s:
        issues.append(f"Slow response ({latency_s:.0f} s)")
    return issues


# ---------- Genie space payload ----------


def new_id() -> str:
    return uuid.uuid4().hex


def build_serialized_space(
    identifiers: list[str],
    instructions: str | None = None,
    sample_questions: list[str] | None = None,
    example_sql: list[tuple[str, str]] | None = None,
) -> str:
    """Return the serialized_space JSON string. Lists the API sorts by key are sorted here."""
    space: dict[str, Any] = {
        "version": 2,
        "data_sources": {"tables": [{"identifier": name} for name in sorted(identifiers)]},
    }
    if sample_questions:
        items = [{"id": new_id(), "question": [text]} for text in sample_questions]
        space["config"] = {"sample_questions": sorted(items, key=lambda item: item["id"])}
    instruction_block: dict[str, Any] = {}
    if instructions:
        instruction_block["text_instructions"] = [{"id": new_id(), "content": [instructions]}]
    if example_sql:
        items = [
            {"id": new_id(), "question": [question], "sql": [line + "\n" for line in sql.rstrip("\n").split("\n")]}
            for question, sql in example_sql
        ]
        instruction_block["example_question_sqls"] = sorted(items, key=lambda item: item["id"])
    if instruction_block:
        space["instructions"] = instruction_block
    return json.dumps(space)


def stable_id(*parts: str) -> str:
    """A 32-character hex ID derived from the parts, so rebuilding the same definition gives the same IDs."""
    return uuid.uuid5(uuid.NAMESPACE_URL, "|".join(parts)).hex


def sql_lines(sql: str) -> list[str]:
    """The API stores SQL as a list of lines; every line but the last keeps its newline."""
    lines = sql.rstrip("\n").split("\n")
    return [line + "\n" for line in lines[:-1]] + [lines[-1]]


def build_agent_space(agent: dict[str, Any], catalog: str, schema: str) -> str:
    """Return the serialized_space JSON for the spec's `genie_agent` block (version 2).

    Covers metric views and tables with per-column settings, one text instruction, example SQL with parameters and
    usage guidance, sample questions, and benchmarks. IDs are derived from the content, so a rerun rebuilds an identical
    definition. Every collection the API validates is sorted the way it requires.
    """

    def source(kind: str) -> list[dict[str, Any]]:
        out = []
        for name in sorted(agent.get(kind, [])):
            entry: dict[str, Any] = {"identifier": f"{catalog}.{schema}.{name}"}
            configs = agent.get("column_configs", {}).get(name)
            if configs:
                entry["column_configs"] = sorted((dict(item) for item in configs), key=lambda item: item["column_name"])
            out.append(entry)
        return out

    space: dict[str, Any] = {"version": 2}
    questions = [{"id": stable_id("sample", text), "question": [text]} for text in agent.get("sample_questions", [])]
    if questions:
        space["config"] = {"sample_questions": sorted(questions, key=lambda item: item["id"])}
    data_sources: dict[str, Any] = {}
    if agent.get("tables"):
        data_sources["tables"] = source("tables")
    if agent.get("metric_views"):
        data_sources["metric_views"] = source("metric_views")
    space["data_sources"] = data_sources

    instruction_block: dict[str, Any] = {}
    if agent.get("instructions"):
        text = agent["instructions"].strip()
        instruction_block["text_instructions"] = [{"id": stable_id("text", text), "content": [text]}]
    examples = []
    for item in agent.get("example_sql", []):
        sql = fill(item["sql"], catalog, schema)
        example: dict[str, Any] = {"id": stable_id("example", item["question"]), "question": [item["question"]], "sql": sql_lines(sql)}
        if item.get("parameters"):
            example["parameters"] = [
                {
                    "name": param["name"],
                    "type_hint": param["type_hint"],
                    "description": [param["description"]],
                    "default_value": {"values": [str(param["default"])]},
                }
                for param in item["parameters"]
            ]
        if item.get("usage_guidance"):
            example["usage_guidance"] = [item["usage_guidance"]]
        examples.append(example)
    if examples:
        instruction_block["example_question_sqls"] = sorted(examples, key=lambda item: item["id"])
    if instruction_block:
        space["instructions"] = instruction_block

    benchmarks = [
        {
            "id": stable_id("benchmark", item["question"]),
            "question": [item["question"]],
            "answer": [{"format": "SQL", "content": sql_lines(fill(item["sql"], catalog, schema))}],
        }
        for item in agent.get("benchmarks", [])
    ]
    if benchmarks:
        space["benchmarks"] = {"questions": sorted(benchmarks, key=lambda item: item["id"])}
    return json.dumps(space)


def definition_summary(serialized_space: str) -> dict[str, int]:
    """Count what a stored space definition holds, for the results table."""
    space = json.loads(serialized_space)
    instructions = space.get("instructions", {})
    sources = space.get("data_sources", {})
    configs = sum(len(entry.get("column_configs", [])) for kind in ("tables", "metric_views") for entry in sources.get(kind, []))
    return {
        "tables": len(sources.get("tables", [])),
        "metric_views": len(sources.get("metric_views", [])),
        "column_configs": configs,
        "text_instructions": len(instructions.get("text_instructions", [])),
        "example_sql": len(instructions.get("example_question_sqls", [])),
        "parameterized_example_sql": sum(1 for item in instructions.get("example_question_sqls", []) if item.get("parameters")),
        "sample_questions": len(space.get("config", {}).get("sample_questions", [])),
        "benchmarks": len(space.get("benchmarks", {}).get("questions", [])),
        "bytes": len(serialized_space.encode("utf-8")),
    }


def field_paths(value: Any, prefix: str = "") -> list[str]:
    """Dotted names of the fields in a JSON object. Lists are walked as `name[]`; values are never returned."""
    paths: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            path = f"{prefix}.{key}" if prefix else key
            if isinstance(item, (dict, list)) and item:
                paths += field_paths(item, path)
            else:
                paths.append(path)
    elif isinstance(value, list):
        for item in value[:1]:  # one element shows the shape
            paths += field_paths(item, f"{prefix}[]")
    return sorted(set(paths))


def split_existing(space_ids: list[str]) -> tuple[str | None, list[str]]:
    """Pick the space to reuse (the first id, in the API's listing order) and the duplicates to delete."""
    if not space_ids:
        return None, []
    return space_ids[0], list(space_ids[1:])


# ---------- Conversation API client ----------


_THROTTLE = re.compile(r"\b429\b|too many requests|rate[ _]limit|too_many|resource_exhausted", re.IGNORECASE)


def is_throttled(error: Exception) -> bool:
    """True for a throttling error. Whole-word matching keeps a hex ID such as 8429e5 from reading as HTTP 429."""
    return bool(_THROTTLE.search(str(error)))


class GenieClient:
    """Thin wrapper over the Genie REST endpoints, using the workspace client's authenticated transport."""

    def __init__(self, workspace_client: Any, pause_seconds: float = 13.0) -> None:
        self.w = workspace_client
        self.pause_seconds = pause_seconds  # the Conversation API allows about 5 questions a minute

    def _call(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        for attempt in range(6):
            try:
                return self.w.api_client.do(method, path, body=body) or {}
            except Exception as error:  # retry throttling only
                if is_throttled(error):
                    time.sleep(20 * (attempt + 1))
                    continue
                raise
        raise RuntimeError(f"{method} {path} kept being throttled")

    def space_url(self, space_id: str) -> str:
        return f"{self.w.config.host.rstrip('/')}/genie/rooms/{space_id}"

    def find_space_ids(self, title: str) -> list[str]:
        found: list[str] = []
        token = None
        while True:
            path = "/api/2.0/genie/spaces" + (f"?page_token={token}" if token else "")
            page = self._call("GET", path)
            found += [s["space_id"] for s in page.get("spaces", []) if s.get("title") == title]
            token = page.get("next_page_token")
            if not token:
                return found

    def upsert_space(self, title: str, description: str, warehouse_id: str, serialized_space: str) -> str:
        """Update the space with this title in place, or create it. Extra spaces with the same title are deleted."""
        keep, extra = split_existing(self.find_space_ids(title))
        body = {"title": title, "description": description, "warehouse_id": warehouse_id, "serialized_space": serialized_space}
        for old_id in extra:
            self._call("DELETE", f"/api/2.0/genie/spaces/{old_id}")
        if keep:
            self._call("PATCH", f"/api/2.0/genie/spaces/{keep}", body)
            return keep
        return self._call("POST", "/api/2.0/genie/spaces", body)["space_id"]

    def ask(self, space_id: str, text: str, conversation_id: str | None = None, timeout_s: int = 420) -> dict[str, Any]:
        """Send one message (new conversation, or a follow-up) and wait for the answer."""
        started = time.time()
        if conversation_id:
            sent = self._call("POST", f"/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages", {"content": text})
            message_id = sent.get("message_id") or sent.get("id")
        else:
            sent = self._call("POST", f"/api/2.0/genie/spaces/{space_id}/start-conversation", {"content": text})
            conversation_id = sent["conversation_id"]
            message_id = sent["message_id"]
        while True:
            message = self._call("GET", f"/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}")
            if message.get("status") in {"COMPLETED", "FAILED", "CANCELLED", "QUERY_RESULT_EXPIRED"}:
                break
            if time.time() - started > timeout_s:
                message["status"] = "TIMEOUT"
                break
            time.sleep(3)
        message["conversation_id"] = conversation_id
        message["message_id"] = message_id
        message["latency_s"] = round(time.time() - started, 1)
        time.sleep(self.pause_seconds)
        return message

    def get_space(self, space_id: str) -> dict[str, Any]:
        """The space with its title, warehouse, and serialized definition."""
        return self._call("GET", f"/api/2.0/genie/spaces/{space_id}?include_serialized_space=true")

    def list_conversations(self, space_id: str) -> list[dict[str, Any]]:
        """Conversations the calling user started in the agent: ID, title, type, and creation time."""
        found: list[dict[str, Any]] = []
        token = None
        while True:
            page = self._call("GET", f"/api/2.0/genie/spaces/{space_id}/conversations" + (f"?page_token={token}" if token else ""))
            found += page.get("conversations", [])
            token = page.get("next_page_token")
            if not token:
                return found

    def list_conversation_ids(self, space_id: str) -> list[str]:
        return [c["conversation_id"] for c in self.list_conversations(space_id) if c.get("conversation_id")]

    def delete_conversation(self, space_id: str, conversation_id: str) -> None:
        self._call("DELETE", f"/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}")

    def list_messages(self, space_id: str, conversation_id: str) -> list[dict[str, Any]]:
        page = self._call("GET", f"/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages")
        return page.get("messages", [])

    def get_message(self, space_id: str, conversation_id: str, message_id: str) -> dict[str, Any]:
        return self._call("GET", f"/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}")

    def get_query_result(self, space_id: str, conversation_id: str, message_id: str, attachment_id: str) -> dict[str, Any]:
        path = f"/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}/attachments/{attachment_id}/query-result"
        return self._call("GET", path)

    def feedback(self, space_id: str, conversation_id: str, message_id: str, rating: str) -> str:
        """Send thumbs up (POSITIVE) or thumbs down (NEGATIVE). Returns 'ok' or the error text."""
        try:
            self._call(
                "POST",
                f"/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}/feedback",
                {"rating": rating},
            )
            return "ok"
        except Exception as error:
            return f"error: {error}"[:300]


def answer_parts(message: dict[str, Any]) -> tuple[str | None, str]:
    """Return (generated SQL, text reply) from a completed Genie message."""
    sql = None
    texts: list[str] = []
    for attachment in message.get("attachments") or []:
        if attachment.get("query") and sql is None:
            sql = attachment["query"].get("query")
            if attachment["query"].get("description"):
                texts.append(attachment["query"]["description"])
        if attachment.get("text"):
            texts.append(attachment["text"].get("content", ""))
    error = message.get("error")
    if error:
        texts.append(f"error: {error.get('error') if isinstance(error, dict) else error}")
    return sql, " ".join(t for t in texts if t).strip()


def run_sql_rows(spark: Any, sql: str) -> list[tuple[Any, ...]]:
    return [tuple(row) for row in spark.sql(sql).collect()]


SPACES_SCHEMA = "run_id string, guide string, role string, space_id string, url string, title string, created_at string"


def register_space(spark: Any, base: str, table: str, row: tuple[str, ...]) -> None:
    """Keep one row per (guide, role) in the spaces table, so a rerun replaces its own entry."""
    spark.sql(f"CREATE TABLE IF NOT EXISTS {base}.{table} ({SPACES_SCHEMA})")
    spark.sql(f"DELETE FROM {base}.{table} WHERE guide = {sql_str(row[1])} AND role = {sql_str(row[2])}")
    spark.createDataFrame([row], SPACES_SCHEMA).write.mode("append").saveAsTable(f"{base}.{table}")
