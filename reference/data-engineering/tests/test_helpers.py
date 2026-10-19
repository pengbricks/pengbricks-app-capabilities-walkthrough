from __future__ import annotations

import sys
from pathlib import Path

import pytest

BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT / "src"))

from de_common.datagen import null_fraction  # noqa: E402
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


def test_null_fraction_reads_percent_nulls():
    assert null_fraction({"name": "a"}) == 0
    assert null_fraction({"name": "a", "percent_nulls": 0.03}) == 0.03
    with pytest.raises(ValueError):
        null_fraction({"name": "a", "percent_nulls": 1})


def test_spec_columns_use_options_the_generator_supports():
    allowed = {"name", "type", "expr", "values", "weights", "min", "max", "begin", "end", "interval", "percent_nulls"}
    for table in (SPEC["tables"]["de_customers"], SPEC["tables"]["de_orders"], SPEC["accounts"]):
        for column in table["columns"]:
            assert set(column) <= allowed, column


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


SCD_SPEC = {"accounts": {"rows": 100, "changes": {"inserts": 10, "updates": 8, "deletes": 5}}}


def _counts(current, history, deleted):
    return {"current_rows": current, "history_rows": history, "keys_with_multiple_rows": 0, "deleted_keys": deleted}


def test_scd_expected_counts_after_changes():
    from de_common.scd import expected

    assert expected(SCD_SPEC, "before") == ({"current_rows": 100, "deleted_keys": 0}, 100)
    assert expected(SCD_SPEC, "after") == ({"current_rows": 105, "deleted_keys": 5}, 118)


def test_scd_problems_reports_each_mismatch():
    from de_common.scd import problems

    good = {"scd1": _counts(105, 105, 5), "scd2": _counts(105, 118, 5)}
    assert problems(good, SCD_SPEC, "after") == []
    bad = {"scd1": _counts(104, 104, 5), "scd2": _counts(105, 117, 5)}
    assert problems(bad, SCD_SPEC, "after") == ["scd1.current_rows=104, expected 105", "scd2.history_rows=117, expected 118"]


# --- CDC guide helpers ---
import json  # noqa: E402

from de_common import cdc  # noqa: E402


def test_batch2_plan_counts_and_history_updates():
    plan = cdc.plan_batch2(500, 50, 120, 30)
    assert plan["final_rows"] == 520
    assert plan["history_updates"] + plan["channel_only_updates"] == 120
    assert plan["channel_only_updates"] == 40


def test_apply_batch2_matches_expected_rows():
    orders = cdc.seed_orders(500)
    plan = cdc.plan_batch2(500, 50, 120, 30)
    after = cdc.apply_batch2(orders, plan)
    assert len(after) == plan["final_rows"]
    assert not {o["order_id"] for o in after} & set(plan["delete_ids"])
    changed = {o["order_id"]: o for o in after}
    first = plan["update_ids"][0]  # position 0 is channel-only
    assert changed[first]["status"] == orders[first]["status"]
    assert changed[first]["channel"] != orders[first]["channel"]
    second = plan["update_ids"][1]
    assert changed[second]["amount"] > orders[second]["amount"]


def test_debezium_event_shapes():
    create = cdc.debezium_event("c", None, {"order_id": 1}, 10, 1000)
    delete = cdc.debezium_event("d", {"order_id": 1}, None, 11, 1001)
    assert create["after"] and create["before"] is None
    assert delete["before"] and delete["after"] is None
    assert create["source"]["lsn"] == 10
    with pytest.raises(ValueError):
        cdc.debezium_event("x", None, None, 1, 1)


def test_batch_events_have_unique_lsns_and_a_late_event():
    orders = cdc.seed_orders(500)
    plan = cdc.plan_batch2(500, 50, 120, 30)
    one = cdc.batch1_events(orders)
    two = cdc.batch2_events(orders, plan)
    assert len(one) == 500
    assert len(two) == 120 + 30 + 50 + 1
    lsns = [e["source"]["lsn"] for e in one + two]
    assert len(set(lsns)) == len(lsns)
    late = two[-1]
    assert max(e["source"]["lsn"] for e in one) < late["source"]["lsn"] < min(e["source"]["lsn"] for e in two[:-1])
    assert {e["op"] for e in two} == {"c", "u", "d"}


def test_event_files_use_fixed_names_and_keep_every_event():
    events = cdc.batch1_events(cdc.seed_orders(250))
    files = cdc.event_files(events, "batch1", per_file=100)
    assert list(files) == ["batch1_part_000.json", "batch1_part_001.json", "batch1_part_002.json"]
    assert sum(len(text.splitlines()) for text in files.values()) == 250
    assert files == cdc.event_files(events, "batch1", per_file=100)
    reversed_files = cdc.event_files(events, "batch1", per_file=100, reverse=True)
    first = json.loads(reversed_files["batch1_part_000.json"].splitlines()[0])
    assert first["source"]["lsn"] == events[-1]["source"]["lsn"]


def test_expected_counts():
    counts = cdc.expected_counts(500, 50, 120, 30)
    assert counts["scd1_final"] == 520
    assert counts["cdf_scd2_final_versions"] == 500 + 50 + 80
    assert counts["snapshot_scd2_final_versions"] == 670


def test_maintenance_type_picks_the_chosen_technique():
    details = {
        "planning_information": {
            "technique_information": [
                {"maintenance_type": "MAINTENANCE_TYPE_ROW_BASED", "is_chosen": True},
                {"maintenance_type": "MAINTENANCE_TYPE_COMPLETE_RECOMPUTE", "is_chosen": False},
            ]
        }
    }
    assert cdc.maintenance_type(details) == "ROW_BASED"
    assert cdc.maintenance_type(json.dumps(details)) == "ROW_BASED"
    assert cdc.maintenance_type(None) is None
    assert cdc.maintenance_type({"planning_information": {"technique_information": []}}) is None


def test_update_refresh_mode_labels():
    assert cdc.update_refresh_mode(True, None) == "full_refresh"
    assert cdc.update_refresh_mode(False, []) == "incremental"
    assert cdc.update_refresh_mode(False, ["cdc_orders_daily"]) == "selective_full_refresh"


def test_dataset_name_strips_catalog_and_flow_suffix():
    assert cdc.dataset_name("c.s.cdc_orders_scd1_flow") == "cdc_orders_scd1"
    assert cdc.dataset_name("cdc_orders_daily") == "cdc_orders_daily"
    assert cdc.dataset_name(None) == ""


def test_flow_numbers_take_the_highest_reported_value():
    events = [
        {"flow_progress": {"status": "RUNNING", "metrics": {}}},
        {"flow_progress": {"status": "RUNNING", "metrics": {"num_upserted_rows": 170, "num_deleted_rows": 30}}},
        {"flow_progress": {"status": "RUNNING", "metrics": {"num_upserted_rows": 120, "num_deleted_rows": 10}}},
        {"flow_progress": {"status": "COMPLETED"}},
    ]
    assert cdc.flow_numbers(events) == {"rows_written": 170, "rows_deleted": 30}
    assert cdc.flow_numbers([{"flow_progress": {"status": "COMPLETED", "metrics": {"num_output_rows": 12}}}]) == {
        "rows_written": 12,
        "rows_deleted": None,
    }
    assert cdc.flow_numbers([{"flow_progress": {"status": "COMPLETED", "metrics": {}}}])["rows_written"] is None


def test_describe_offsets_for_delta_and_auto_loader():
    delta = json.dumps(
        {"sources": [{"startOffset": {"reservoirVersion": 2}, "endOffset": {"reservoirVersion": 4}, "metrics": {}}]}
    )
    assert cdc.describe_offsets([delta]) == "Delta version v2 to v4"
    first = json.dumps({"sources": [{"startOffset": None, "endOffset": {"seqNum": 7}, "metrics": {"batchSizeNumFiles": "5"}}]})
    second = json.dumps(
        {"sources": [{"startOffset": {"seqNum": 7}, "endOffset": {"seqNum": 21}, "metrics": {"batchSizeNumFiles": "3"}}]}
    )
    assert cdc.describe_offsets([first]) == "5 new files, start to queue 7"
    assert cdc.describe_offsets([second]) == "3 new files, queue 7 to queue 21"
    assert cdc.describe_offsets([]) is None


def test_rows_read_sums_batches_for_the_named_flow():
    first = json.dumps({"observedMetrics": {
        "pipelines.expectations.cdc_orders_feed": {"total": 500},
        "pipelines.expectations.cat.sch.cdc_orders_scd1_flow": {"total": 500}}})
    second = json.dumps({"observedMetrics": {"pipelines.expectations.cat.sch.cdc_orders_scd1_flow": {"total": 201}}})
    assert cdc.rows_read([first, second], "cat.sch.cdc_orders_scd1_flow") == 701
    assert cdc.rows_read([first], "cdc_orders_feed") == 500
    assert cdc.rows_read([json.dumps({"observedMetrics": {}})], "x") is None
    assert cdc.rows_read([], "x") is None
