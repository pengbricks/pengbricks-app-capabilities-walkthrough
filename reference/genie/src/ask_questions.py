"""Helpers for the ask notebooks: create a Genie space for one stage and ask it every question in the spec.

baseline  space over the raw tables only: no comments, no metric view, no instructions
enhanced  space over the metric view, with instructions, sample questions, and an example query
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from genie_lib import GenieClient, answer_parts, build_serialized_space, fill, register_space, rows_match, run_sql_rows

COMPARISON_TABLE = "ontology_comparison"
SPACES_TABLE = "genie_spaces"
COMPARISON_SCHEMA = (
    "run_id string, question_id string, stage string, question string, status string, genie_sql string, expected_sql string, "
    "matches_expected boolean, genie_rows string, expected_rows string, note string, latency_s double, asked_at string"
)


def stage_space(spec: dict, catalog: str, schema: str, stage: str) -> tuple[str, str]:
    """Return (title, serialized_space) for the stage's Genie space."""
    genie_spec = spec["genie"]
    base = f"{catalog}.{schema}"
    if stage == "baseline":
        serialized = build_serialized_space([f"{base}.{table['name']}" for table in spec["tables"]])
    else:
        serialized = build_serialized_space(
            [f"{base}.{spec['metric_view']['name']}"],
            instructions=genie_spec["instructions"].strip(),
            sample_questions=genie_spec["sample_questions"],
            example_sql=[(item["question"], fill(item["sql"], catalog, schema)) for item in genie_spec["example_sql"]],
        )
    return f"{spec['space_prefix']} ({stage}) [{schema}]", serialized


def ask_all(spark, client: GenieClient, space_id: str, spec: dict, catalog: str, schema: str, stage: str, run_id: str) -> list[tuple]:
    """Ask every spec question and compare Genie's rows with the expected SQL. One output row per question."""
    now = datetime.now(timezone.utc).isoformat()
    rows_out = []
    for question in spec["questions"]:
        expected_sql = fill(question["expected_sql"], catalog, schema)
        expected = run_sql_rows(spark, expected_sql)
        message = client.ask(space_id, question["text"])
        sql, text = answer_parts(message)
        got, note = [], ""
        if sql:
            try:
                got = run_sql_rows(spark, sql)
            except Exception as error:
                note = f"Generated SQL failed: {str(error)[:200]}"
        else:
            note = f"No SQL. {text[:200]}"
        matches = bool(sql) and not note and rows_match(expected, got)
        rows_out.append(
            (
                run_id, question["id"], stage, question["text"], message.get("status"), sql or "",
                expected_sql.strip(), matches, json.dumps([[str(c) for c in r] for r in got[:20]]),
                json.dumps([[str(c) for c in r] for r in expected[:20]]), note, message.get("latency_s"), now,
            )
        )
        print(f"[{stage}] {question['id']}: match={matches}")
    return rows_out


def write_answers(spark, base: str, stage: str, rows_out: list[tuple]) -> None:
    """Replace the stage's answers in ontology_comparison."""
    spark.sql(f"CREATE TABLE IF NOT EXISTS {base}.{COMPARISON_TABLE} ({COMPARISON_SCHEMA})")
    spark.sql(f"DELETE FROM {base}.{COMPARISON_TABLE} WHERE stage = '{stage}'")  # a rerun replaces this stage's answers
    spark.createDataFrame(rows_out, COMPARISON_SCHEMA).write.mode("append").saveAsTable(f"{base}.{COMPARISON_TABLE}")
