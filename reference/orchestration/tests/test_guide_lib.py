from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import guide_lib as g  # noqa: E402

SPEC = g.load_spec(str(ROOT / "use_cases" / "general.yml"))


def test_psi_identical_is_zero():
    assert g.psi([10, 20, 30], [10, 20, 30]) == pytest.approx(0.0)


def test_psi_shift_is_positive_and_symmetric_in_sign():
    value = g.psi([25, 25, 25, 25], [5, 15, 30, 50])
    assert value > 0.2
    assert g.psi([5, 15, 30, 50], [25, 25, 25, 25]) > 0.2


def test_psi_handles_empty_bin_with_floor():
    assert math.isfinite(g.psi([50, 50, 0], [10, 40, 50]))


def test_psi_rejects_mismatched_bins():
    with pytest.raises(ValueError):
        g.psi([1, 2], [1, 2, 3])


def test_histogram_and_edges():
    edges = g.quantile_edges(list(range(100)), 4)
    assert edges == [25, 50, 75]
    assert g.histogram([0, 24, 25, 99, 100], edges) == [2, 1, 0, 2]


def test_mean_shift_pct():
    assert g.mean_shift_pct(100, 130) == pytest.approx(30.0)
    with pytest.raises(ValueError):
        g.mean_shift_pct(0, 1)


def test_psi_label():
    assert g.psi_label(0.05) == "stable"
    assert g.psi_label(0.15) == "moderate"
    assert g.psi_label(0.5) == "significant"


def test_diff_schemas_finds_added_and_changed():
    before = {"id": "string", "quantity": "int"}
    after = {"id": "string", "quantity": "bigint", "loyalty_tier": "string"}
    events = g.diff_schemas(before, after)
    assert {(e["change_type"], e["column_name"]) for e in events} == {
        ("COLUMN_ADDED", "loyalty_tier"),
        ("TYPE_CHANGED", "quantity"),
    }
    changed = next(e for e in events if e["change_type"] == "TYPE_CHANGED")
    assert (changed["old_type"], changed["new_type"]) == ("int", "bigint")


def test_diff_schemas_finds_drop_and_no_change():
    assert g.diff_schemas({"a": "int"}, {"a": "int"}) == []
    assert g.diff_schemas({"a": "int", "b": "int"}, {"a": "int"})[0]["change_type"] == "COLUMN_DROPPED"


def test_schema_changing_history_filters_by_version_and_operation():
    rows = [
        {"version": 0, "operation": "CREATE OR REPLACE TABLE AS SELECT"},
        {"version": 1, "operation": "ADD COLUMNS"},
        {"version": 2, "operation": "WRITE"},
        {"version": 3, "operation": "CHANGE COLUMN"},
    ]
    kept = g.schema_changing_history(rows, after_version=0)
    assert [r["version"] for r in kept] == [1, 3]


def test_apply_overrides_does_not_mutate_spec():
    shifted = g.apply_overrides(SPEC["entity"]["columns"], SPEC["observability"]["batches"][1]["overrides"])
    amount = next(c for c in shifted if c["name"] == "amount")
    assert (amount["min"], amount["max"]) == (120, 380)
    original = next(c for c in SPEC["entity"]["columns"] if c["name"] == "amount")
    assert (original["min"], original["max"]) == (10, 200)


def test_column_options_for_each_kind():
    assert g.column_options({"name": "x", "type": "string", "expr": "1"}) == {"expr": "1", "baseColumn": "id"}
    opts = g.column_options({"name": "r", "type": "string", "values": ["a", "b"], "weights": [1, 2]})
    assert opts["weights"] == [1, 2] and opts["random"] is True
    assert g.column_options({"name": "q", "type": "int", "min": 1, "max": 5})["maxValue"] == 5


def test_plan_pause_change_and_counts():
    jobs = [
        {"job_id": 1, "schedule_status": "UNPAUSED"},
        {"job_id": 2, "schedule_status": "PAUSED"},
        {"job_id": 3, "schedule_status": None},
    ]
    assert [j["job_id"] for j in g.plan_pause_change(jobs, "PAUSED")] == [1]
    assert [j["job_id"] for j in g.plan_pause_change(jobs, "UNPAUSED")] == [2]
    assert g.count_states(jobs) == {"PAUSED": 1, "UNPAUSED": 1}
