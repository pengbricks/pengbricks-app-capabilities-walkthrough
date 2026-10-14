from __future__ import annotations

import sys
from pathlib import Path

import pytest

BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT / "src"))

from de_common.datagen import column_options  # noqa: E402
from de_common.files import MAX_WIDTH, MIN_WIDTH, column_widths, merge_metrics  # noqa: E402
from de_common.spec import load_use_case, plan_changes  # noqa: E402

SPEC = load_use_case(BUNDLE_ROOT / "use_cases" / "general.yml")


def test_plan_changes_are_disjoint_and_counted():
    plan = plan_changes(1000, 60, 150, 40)
    assert len(plan["update_ids"]) == 150
    assert len(plan["delete_ids"]) == 40
    assert not set(plan["update_ids"]) & set(plan["delete_ids"])
    assert min(plan["insert_ids"]) == 1000
    assert plan["final_rows"] == 1020


def test_plan_changes_rejects_overflow():
    with pytest.raises(ValueError):
        plan_changes(10, 0, 50, 0)


def test_spec_changes_fit_in_rows():
    accounts = SPEC["accounts"]
    plan = plan_changes(accounts["rows"], **accounts["changes"])
    assert max(plan["update_ids"] + plan["delete_ids"]) < accounts["rows"]


def test_column_options_for_expr_and_random():
    assert column_options({"expr": "id + 1"}) == {"expr": "id + 1", "baseColumn": "id"}
    options = column_options({"values": ["a", "b"], "weights": [1, 2], "percent_nulls": 0.1})
    assert options["random"] is True
    assert options["percentNulls"] == 0.1
    assert options["weights"] == [1, 2]


def test_column_widths_clamp_and_pad():
    widths = column_widths(["id", "name"], [["1", "x" * 200], ["22", "bob"]])
    assert widths[0] == MIN_WIDTH
    assert widths[1] == MAX_WIDTH


def test_column_widths_handle_none():
    assert column_widths(["a"], [[None]]) == [MIN_WIDTH]


def test_merge_metrics_defaults_to_zero():
    metrics = merge_metrics({"numTargetRowsInserted": "60", "numTargetRowsUpdated": "150"})
    assert metrics["inserted"] == 60
    assert metrics["updated"] == 150
    assert metrics["deleted"] == 0
