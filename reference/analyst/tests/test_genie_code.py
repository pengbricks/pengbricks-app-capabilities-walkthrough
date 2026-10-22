import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from analyst_common import genie_code as g


def test_every_table_is_gc_prefixed_and_ordered():
    tables = g.expected_tables()
    assert all(t.startswith("gc_") for t in tables)
    assert tables.index(g.SILVER_TABLE) > tables.index("gc_orders")
    assert tables[-2:] == list(g.GOLD_TABLES)


def test_sample_spec_covers_sample_tables():
    assert set(g.SAMPLE_SPEC) == set(g.SAMPLE_TABLES)
    for table in g.SAMPLE_SPEC.values():
        assert table["rows"] > 0 and table["columns"]


def test_orders_reference_existing_key_ranges():
    spec = g.SAMPLE_SPEC
    assert "% 2000" in spec["gc_orders"]["columns"][1]["expr"] and spec["gc_customers"]["rows"] == 2000
    assert "% 30" in spec["gc_orders"]["columns"][2]["expr"] and spec["gc_products"]["rows"] == 30


def test_has_prefix_ignores_case_and_folder():
    assert g.has_prefix("/Users/a@x.com/GC_orders_analysis")
    assert not g.has_prefix("/Users/a@x.com/orders_gc_")


def test_filter_assets_sorts_matches():
    assert g.filter_assets(["b", "gc_b", "gc_a"]) == ["gc_a", "gc_b"]


def test_missing_tables_is_case_insensitive():
    assert g.missing_tables(["GC_CUSTOMERS"], ["gc_customers", "gc_orders"]) == ["gc_orders"]


def test_reconcile_matches_and_flags():
    assert g.reconcile("10.00", "10.00", "10.00", "10.00") == []
    findings = g.reconcile("10.00", "10.00", "9.00", "10.00")
    assert len(findings) == 1 and "gold sales" in findings[0]


def test_grain_duplicates():
    assert g.grain_duplicates(10, 10) == 0
    assert g.grain_duplicates(12, 10) == 2
    assert g.grain_duplicates(8, 10) == 0


def test_howto_names_only_missing_steps():
    assert g.howto_for_missing(True, True, True) == []
    steps = g.howto_for_missing(True, False, False)
    assert len(steps) == 2 and g.NOTEBOOK_NAME in steps[0] and g.DASHBOARD_NAME in steps[1]


def test_unknown_listing_is_not_reported_as_missing():
    assert g.howto_for_missing(None, None, None) == []
    assert len(g.unverified_steps(None, True, None)) == 2
    assert g.unverified_steps(True, True, True) == []
