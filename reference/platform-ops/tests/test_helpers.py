from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from admin_lib import action, evaluate_warehouse, is_owned_name, ledger_merge_sql, tokens_expiring  # noqa: E402
from support_lib import (  # noqa: E402
    classify,
    failed_tasks,
    incident_id,
    latest_attempts,
    match_on_call,
    pick_repair_target,
    route_for,
)

SPEC = yaml.safe_load((ROOT / "use_cases" / "general.yml").read_text())
SUPPORT = SPEC["support"]
ADMIN = SPEC["admin"]


def test_owned_names_use_guide_prefix():
    assert is_owned_name(ADMIN["group_name"])
    assert is_owned_name(ADMIN["budget_policy_name"])
    assert is_owned_name(ADMIN["cluster_policy_name"])
    assert not is_owned_name("shared-analysts")


def test_action_rejects_unknown_status():
    with pytest.raises(ValueError):
        action("roles", "x", "y", "done")


def test_warehouse_flags():
    assert evaluate_warehouse("a", "Small", 10, True, 60)["status"] == "ok"
    assert evaluate_warehouse("a", "Small", 0, True, 60)["status"] == "flagged"
    assert evaluate_warehouse("a", "Small", 120, False, 60)["status"] == "flagged"


def test_tokens_expiring_ignores_no_expiry():
    day = 86_400_000
    toks = [{"token_id": "a", "expiry_time": 10 * day}, {"token_id": "b", "expiry_time": 90 * day}, {"token_id": "c", "expiry_time": -1}]
    assert [t["token_id"] for t in tokens_expiring(toks, 0, 30)] == ["a"]


def test_ledger_merge_is_keyed_so_retries_do_not_duplicate():
    sql = ledger_merge_sql("t", "v")
    assert "ON t.run_id = s.run_id AND t.category = s.category AND t.action = s.action AND t.target = s.target" in sql
    assert "WHEN MATCHED THEN UPDATE" in sql


@pytest.mark.parametrize(
    "text,expected",
    [
        ("PERMISSION_DENIED: user cannot SELECT", "permission"),
        ("[PRINCIPAL_DOES_NOT_EXIST] Could not find principal", "missing_dependency"),
        ("TransientSourceError: upstream dependency unavailable", "transient"),
        ("[DELTA_METADATA_CHANGED] MetadataChangedException", "concurrency"),
        ("TypeError: missing 1 required argument", "code_error"),
        ("something nobody has seen", "unclassified"),
        (None, "unclassified"),
    ],
)
def test_classify(text, expected):
    assert classify(text, SUPPORT["error_classes"], SUPPORT["default_error_class"])[0] == expected


def test_permission_errors_are_high_severity():
    assert classify("PERMISSION_DENIED", SUPPORT["error_classes"], SUPPORT["default_error_class"])[1] == "high"


def test_on_call_matches_job_tag_then_use_case_then_fallback():
    rows = SUPPORT["on_call"]
    assert match_on_call({"capability_guide_job": "capability_guides_dataops"}, rows)["owner_team"] == "data-engineering"
    assert match_on_call({"capability_guide_job": "other", "capability_guide_use_case": "general"}, rows)["owner_team"] == "capability-guides"
    assert match_on_call({"capability_guide_job": "other"}, rows)["tag_key"] == "*"


def test_on_call_requires_fallback():
    with pytest.raises(LookupError):
        match_on_call({}, [r for r in SUPPORT["on_call"] if r["tag_key"] != "*"])


def test_high_severity_pages_escalation_contact():
    row = SUPPORT["on_call"][0]
    assert row["escalation_contact"] in route_for("high", row)
    assert route_for("low", row).startswith("notify")


def test_latest_attempt_wins_so_a_recovered_retry_is_not_an_incident():
    tasks = [
        {"task_key": "load", "attempt_number": 0, "result_state": "FAILED"},
        {"task_key": "load", "attempt_number": 1, "result_state": "SUCCESS"},
        {"task_key": "step", "attempt_number": 0, "result_state": "FAILED"},
    ]
    assert [t["task_key"] for t in latest_attempts(tasks)] == ["load", "step"]
    assert [t["task_key"] for t in failed_tasks({"tasks": tasks})] == ["step"]


def test_pick_repair_target_skips_running_and_repaired_runs():
    failed = [{"task_key": "fragile_step", "attempt_number": 0, "result_state": "FAILED"}]
    runs = [
        {"run_id": 3, "start_time": 30, "finished": False, "repair_count": 0, "tasks": failed},
        {"run_id": 2, "start_time": 20, "finished": True, "repair_count": 1, "tasks": failed},
        {"run_id": 1, "start_time": 10, "finished": True, "repair_count": 0, "tasks": failed},
    ]
    assert pick_repair_target(runs, "fragile_step")["run_id"] == 1
    assert pick_repair_target(runs, "other_task") is None


def test_incident_id_is_stable():
    assert incident_id(7, "fragile_step", "jobs_api") == "7:fragile_step:jobs_api"
