import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import dab_starter_lib as lib  # noqa: E402


def test_layers_that_agree_have_no_problems():
    assert lib.check_layers(100, 100, 90, 70, 70) == []


def test_each_disagreement_is_reported():
    problems = lib.check_layers(100, 99, 120, 5, 6)
    assert len(problems) == 3
    assert "bronze has 99 rows, expected 100" in problems[0]
    assert "silver has 120 rows" in problems[1]
    assert "gold counts 5 orders" in problems[2]


def test_empty_silver_is_a_problem():
    assert any("silver has 0 rows" in p for p in lib.check_layers(10, 10, 0, 0, 0))


def event(*expectations):
    return json.dumps({"flow_progress": {"data_quality": {"expectations": list(expectations)}}})


def test_expectation_totals_add_up_across_events_and_accept_dicts():
    quantity = {"name": "quantity_positive", "dataset": "orders_silver", "passed_records": 90, "failed_records": 10}
    price = {"name": "price_in_range", "dataset": "orders_silver", "passed_records": 100, "failed_records": 0}
    totals = lib.expectation_totals([event(quantity, price), {"flow_progress": {}}, event(quantity), "null"])
    assert totals == [
        {"dataset": "orders_silver", "name": "price_in_range", "passed": 100, "failed": 0},
        {"dataset": "orders_silver", "name": "quantity_positive", "passed": 180, "failed": 20},
    ]


def test_events_without_expectations_are_skipped():
    assert lib.expectation_totals([{"flow_progress": {"metrics": {"num_output_rows": 5}}}]) == []
