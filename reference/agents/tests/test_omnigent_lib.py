import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import omnigent_lib as ol  # noqa: E402


def dataset(seed=42):
    customers = ol.generate_customers(seed)
    orders = ol.generate_orders(seed, customers)
    events = ol.generate_events(seed, orders)
    return customers, orders, events


def test_raw_paths_are_fixed():
    paths = ol.raw_paths("main", "capability_guides", "omnigent_raw")
    assert paths["orders"] == "/Volumes/main/capability_guides/omnigent_raw/orders.csv"
    assert paths["customers"].endswith("/customers.json")
    assert paths["events"][0].endswith("/events/events_001.json")
    assert len(paths["events"]) == 3


def test_raw_paths_reject_bad_names():
    with pytest.raises(ValueError):
        ol.raw_paths("main", "bad schema; drop", "omnigent_raw")


def test_same_seed_gives_same_bytes():
    a, b = dataset(42), dataset(42)
    assert ol.orders_to_csv(a[1]) == ol.orders_to_csv(b[1])
    assert ol.to_json_lines(a[0]) == ol.to_json_lines(b[0])
    assert [ol.to_json_lines(x) for x in a[2]] == [ol.to_json_lines(x) for x in b[2]]


def test_different_seed_changes_orders():
    assert ol.orders_to_csv(dataset(1)[1]) != ol.orders_to_csv(dataset(2)[1])


def test_orders_have_the_planted_defects():
    _, orders, _ = dataset()
    ids = [r["order_id"] for r in orders]
    assert len(orders) == 200
    assert len(set(ids)) < len(ids)
    assert any(r["amount"] == "" for r in orders)


def test_csv_round_trip():
    _, orders, _ = dataset()
    assert ol.parse_orders_csv(ol.orders_to_csv(orders)) == [{k: str(v) for k, v in r.items()} for r in orders]


def test_events_reference_real_orders():
    _, orders, events = dataset()
    ids = {r["order_id"] for r in orders}
    assert len(events) == 3
    assert all(e["order_id"] in ids for batch in events for e in batch)


def test_json_lines_round_trip():
    customers, _, _ = dataset()
    assert ol.parse_json_lines(ol.to_json_lines(customers)) == customers


def test_expected_counts_apply_silver_rules():
    customers, orders, events = dataset()
    flat = [e for batch in events for e in batch]
    got = ol.expected_counts(ol.parse_orders_csv(ol.orders_to_csv(orders)), customers, flat)
    assert got["bronze_orders"] == 200
    assert got["bronze_customers"] == 40
    assert got["bronze_events"] == 45
    assert got["silver_orders"] == got["gold_order_count"]
    assert got["silver_orders"] < 200
    total = sum(float(r["amount"]) for r in {r["order_id"]: r for r in orders if r["amount"]}.values())
    assert got["gold_revenue"] == pytest.approx(total)


def test_find_pipeline_ignores_dev_prefix():
    names = ["other", "[dev rob] omnigent_orders", "omnigent_b"]
    assert ol.find_pipeline(names, "omnigent_") == "[dev rob] omnigent_orders"
    assert ol.find_pipeline(["other"], "omnigent_") is None


def test_classify_tables_by_layer():
    groups = ol.classify_tables(
        ["omni_bronze_orders", "omni_silver_orders", "omni_gold_daily_revenue", "agent_orders", "OMNI_BRONZE_EVENTS"], "omni_"
    )
    assert groups["bronze"] == ["OMNI_BRONZE_EVENTS", "omni_bronze_orders"]
    assert groups["silver"] == ["omni_silver_orders"]
    assert groups["gold"] == ["omni_gold_daily_revenue"]


def test_table_for_picks_by_hint():
    groups = ol.classify_tables(["omni_bronze_orders", "omni_bronze_events"], "omni_")
    assert ol.table_for(groups, "bronze", "events") == "omni_bronze_events"
    assert ol.table_for(groups, "silver", "orders") is None


def test_reconcile_statuses():
    checks = ol.reconcile({"a": 5, "b": 5, "c": 1.5, "d": 2}, {"a": 5, "b": 4, "c": 1.5})
    assert {c["check"]: c["status"] for c in checks} == {"a": "pass", "b": "fail", "c": "pass", "d": "missing"}


FULL = {layer: [f"omni_{layer}_x"] for layer in ol.LAYERS}
EMPTY = {layer: [] for layer in ol.LAYERS}


def test_status_needs_manual_check_before_omnigent_runs():
    assert ol.overall_status(None, EMPTY, []) == "needs_manual_check"


def test_status_needs_manual_check_when_a_layer_is_missing():
    partial = {**FULL, "gold": []}
    assert ol.overall_status("omnigent_x", partial, []) == "needs_manual_check"


def test_status_pass_and_fail():
    ok = [{"status": "pass"}]
    bad = [{"status": "pass"}, {"status": "fail"}]
    assert ol.overall_status("p", FULL, ok) == "pass"
    assert ol.overall_status("p", FULL, bad) == "fail"
    assert ol.overall_status("p", FULL, [{"status": "missing"}]) == "needs_manual_check"


def test_manual_steps_list_what_is_left():
    assert "prompt 1" in ol.manual_steps(None, EMPTY)[0]
    assert ol.manual_steps("p", FULL) == []


def test_prompts_file_matches_the_names_the_check_expects():
    text = (ROOT / "guides" / "omnigent" / "prompts.md").read_text()
    for name in ("omni_bronze_orders", "omni_silver_orders", "omni_gold_daily_revenue", "omnigent_orders", "order_count", "revenue"):
        assert name in text
    filled = ol.render_prompts(text, "main", "capability_guides")
    assert "/Volumes/main/capability_guides/omnigent_raw/orders.csv" in filled
    assert "<catalog>" not in filled and "<schema>" not in filled


def test_job_yaml_is_tagged_and_serverless():
    import yaml

    job = yaml.safe_load((ROOT / "resources" / "omnigent.job.yml").read_text())["resources"]["jobs"]["capability_guides_omnigent"]
    assert job["tags"]["capability_guide_job"] == "capability_guides_omnigent"
    assert [t["task_key"] for t in job["tasks"]] == ["preflight_raw_volume", "check_pipeline"]
    assert not any(k in job for k in ("job_clusters", "existing_cluster_id"))
    for task in job["tasks"]:
        assert (ROOT / "resources" / task["notebook_task"]["notebook_path"]).exists()
