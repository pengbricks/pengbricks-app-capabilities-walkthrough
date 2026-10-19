from __future__ import annotations

import json
import sys
from decimal import Decimal
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from genie_lib import (  # noqa: E402
    answer_parts,
    build_serialized_space,
    fill,
    find_issues,
    load_spec,
    metric_view_yaml,
    rows_match,
    sql_str,
)

SPEC = load_spec(ROOT / "use_cases" / "general.yml")


def test_rows_match_ignores_order_names_and_extra_columns() -> None:
    expected = [("EMEA", Decimal("10.004")), ("APAC", 5)]
    assert rows_match(expected, [("apac", 5.0, "extra"), ("EMEA", 10.0)])


def test_codes_do_not_match_names() -> None:
    assert not rows_match([("North America", 10)], [("NA", 10)])


def test_row_count_and_values_must_match() -> None:
    assert not rows_match([("a", 1)], [("a", 1), ("b", 2)])
    assert not rows_match([("a", 1)], [("a", 2)])


def test_each_returned_row_is_used_once() -> None:
    assert not rows_match([("a", 1), ("a", 1)], [("a", 1), ("b", 2)])


def test_serialized_space_is_sorted_and_single_instruction() -> None:
    raw = build_serialized_space(["c.s.b", "c.s.a"], "glossary", ["q1", "q2", "q3"], [("q", "SELECT 1\nFROM t")])
    space = json.loads(raw)
    assert space["version"] == 2
    assert [t["identifier"] for t in space["data_sources"]["tables"]] == ["c.s.a", "c.s.b"]
    ids = [q["id"] for q in space["config"]["sample_questions"]]
    assert ids == sorted(ids) and len(ids) == 3
    assert len(space["instructions"]["text_instructions"]) == 1
    assert "".join(space["instructions"]["example_question_sqls"][0]["sql"]) == "SELECT 1\nFROM t\n"


def test_baseline_space_has_no_semantics() -> None:
    space = json.loads(build_serialized_space(["c.s.a"]))
    assert "instructions" not in space and "config" not in space


def test_metric_view_yaml_resolves_names_and_has_synonyms() -> None:
    text = metric_view_yaml(SPEC, "cat", "sch")
    parsed = yaml.safe_load(text)
    assert parsed["version"] == "1.1"
    assert parsed["source"] == "cat.sch.ord_fact"
    assert parsed["joins"][0]["source"] == "cat.sch.cust"
    assert all(item.get("synonyms") for item in parsed["dimensions"] + parsed["measures"])


def test_spec_questions_have_expected_sql_and_unique_ids() -> None:
    ids = [q["id"] for q in SPEC["questions"]]
    assert len(ids) == len(set(ids))
    assert all("{catalog}.{schema}" in q["expected_sql"] for q in SPEC["questions"])
    assert "cat.sch.cust" in fill(SPEC["questions"][0]["expected_sql"], "cat", "sch")


def test_ux_script_feedback_targets_exist() -> None:
    steps = SPEC["ux_script"]["steps"]
    ids = [s["id"] for s in steps]
    for step in steps:
        if step["task_type"] == "feedback":
            assert step["target"] in ids[: ids.index(step["id"])]
    assert {"discovery", "question", "refinement", "feedback"} <= {s["task_type"] for s in steps}


def test_find_issues() -> None:
    assert find_issues("COMPLETED", True, True, 5, 45) == []
    assert "Result differs from the expected answer" in find_issues("COMPLETED", True, False, 5, 45)
    assert any("text only" in i for i in find_issues("COMPLETED", False, None, 5, 45))
    assert any("Slow" in i for i in find_issues("COMPLETED", True, True, 60, 45))
    assert any("Ambiguous" in i for i in find_issues("COMPLETED", True, None, 5, 45, ambiguous=True))
    assert find_issues("COMPLETED", False, None, 5, 45, expects_sql=False) == []


def test_answer_parts_and_quoting() -> None:
    message = {"attachments": [{"query": {"query": "SELECT 1", "description": "d"}}, {"text": {"content": "hi"}}]}
    assert answer_parts(message) == ("SELECT 1", "d hi")
    assert sql_str("it's") == "'it''s'"


def test_clarifying_question_is_an_issue_for_ambiguous_prompts() -> None:
    issues = find_issues("COMPLETED", False, None, 5, 45, ambiguous=True, expects_sql=False, response_text="Do you mean segments?")
    assert issues == ["Genie asked a clarifying question instead of answering"]
    assert find_issues("COMPLETED", False, None, 5, 45, ambiguous=True, expects_sql=False, response_text="No data.") == []


def test_split_existing_reuses_first_space_and_flags_duplicates() -> None:
    from genie_lib import split_existing

    assert split_existing([]) == (None, [])
    assert split_existing(["a"]) == ("a", [])
    assert split_existing(["a", "b", "c"]) == ("a", ["b", "c"])


def test_spec_columns_use_options_the_sample_data_generator_supports():
    import sample_data

    for table in SPEC["tables"]:
        for column in table["columns"]:
            assert column["type"].startswith("decimal") or column["type"] in {"int", "double", "string", "date", "timestamp", "bigint"}
            if "weights" in column:
                assert len(column["weights"]) == len(column["values"])
                sample_data.cumulative_weights(column["weights"])
            if "begin" in column:
                sample_data.interval_seconds(column["interval"])
                assert sample_data.grid_steps(column["begin"], column["end"], column["interval"]) > 1
