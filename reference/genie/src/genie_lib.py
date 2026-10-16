"""Helpers shared by the Genie guide tasks: spec loading, space payloads, answer comparison, and a thin Conversation API client."""

from __future__ import annotations

import json
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


def split_existing(space_ids: list[str]) -> tuple[str | None, list[str]]:
    """Pick the space to reuse (the first id, in the API's listing order) and the duplicates to delete."""
    if not space_ids:
        return None, []
    return space_ids[0], list(space_ids[1:])


# ---------- Conversation API client ----------


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
                text = str(error).upper()
                if "429" in text or "RATE" in text or "TOO_MANY" in text:
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
