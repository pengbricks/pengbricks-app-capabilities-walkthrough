import re
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import mv_lib as m  # noqa: E402

GUIDE = ROOT / "guides" / "metric-views"


@pytest.fixture(scope="module")
def data():
    customers = m.make_customers()
    products = m.make_products()
    return customers, products, m.make_orders(customers, products), m.make_sessions(customers)


def test_data_is_deterministic(data):
    customers, products, orders, sessions = data
    assert m.make_customers() == customers
    assert m.make_orders(customers, products) == orders
    assert m.make_sessions(customers) == sessions


def test_keys_are_unique_and_foreign_keys_resolve(data):
    customers, products, orders, sessions = data
    customer_ids = {c[0] for c in customers}
    product_ids = {p[0] for p in products}
    assert len(customer_ids) == len(customers) == m.N_CUSTOMERS
    assert len(product_ids) == len(products) == m.N_PRODUCTS
    assert len({o[0] for o in orders}) == len(orders) == m.N_ORDERS
    assert {o[1] for o in orders} <= customer_ids
    assert {o[2] for o in orders} <= product_ids
    assert len({s[0] for s in sessions}) == len(sessions)
    assert {s[1] for s in sessions} <= customer_ids


def test_orders_cover_every_status_and_stay_in_range(data):
    _, _, orders, sessions = data
    assert {o[7] for o in orders} == set(m.STATUSES)
    assert all(m.START <= o[3] <= m.END for o in orders)
    assert all(m.START <= s[2] <= m.END for s in sessions)
    # The window checks assume no empty month among completed orders.
    months = {(o[3].year, o[3].month) for o in orders if o[7] == "completed"}
    assert len(months) == 21


def test_daily_average_conversion_differs_from_overall_rate(data):
    # The guide's pitfall: the average of daily rates must not equal the pooled rate.
    sessions = data[3]
    per_day: dict = {}
    for _, _, day, _, converted in sessions:
        total, won = per_day.get(day, (0, 0))
        per_day[day] = (total + 1, won + int(converted))
    pooled = sum(w for _, w in per_day.values()) / sum(t for t, _ in per_day.values())
    average = sum(w / t for t, w in per_day.values()) / len(per_day)
    assert abs(pooled - average) > 0.02


def test_close_handles_missing_and_tolerance():
    assert m.close(1.0, 1.0 + 1e-12)
    assert not m.close(1.0, 1.01)
    assert m.close(None, None)
    assert not m.close(None, 1.0)


def test_compare_groups_counts_matches_and_missing_groups():
    view = [{"k": "a", "x": 1.0}, {"k": "b", "x": 2.0}]
    assert m.compare_groups(view, [{"k": "a", "x": 1.0}, {"k": "b", "x": 2.0}], ["k"], "x")["passed"]
    bad = m.compare_groups(view, [{"k": "a", "x": 1.0}, {"k": "b", "x": 2.5}], ["k"], "x")
    assert (bad["matched"], bad["checked"], bad["passed"]) == (1, 2, False)
    assert bad["top"] == ("b",)
    missing = m.compare_groups(view, [{"k": "a", "x": 1.0}], ["k"], "x")
    assert (missing["matched"], missing["checked"], missing["passed"]) == (1, 2, False)
    total = m.compare_groups([{"x": 5.0}], [{"x": 5.0}], [], "x")
    assert total["passed"] and total["checked"] == 1


def test_fq_quotes_each_part():
    assert m.fq("c", "s", "t") == "`c`.`s`.`t`"


def metric_view_yaml(path: Path) -> dict:
    match = re.search(r"AS \$\$\n(.*?)\n\$\$;", path.read_text(), flags=re.S)
    assert match, f"{path.name}: no $$ YAML block"
    return yaml.safe_load(match.group(1))


@pytest.mark.parametrize("file_name", ["02_orders_metric_view.sql", "03_funnel_metric_view.sql"])
def test_metric_view_yaml_is_well_formed(file_name):
    spec = metric_view_yaml(GUIDE / file_name)
    assert spec["version"] == 1.1
    assert spec["source"] in m.TABLES.values()
    assert spec["fields"] and spec["measures"]
    names = [x["name"] for x in spec["fields"] + spec["measures"]]
    assert len(names) == len(set(names)), "field and measure names must be unique"
    for join in spec["joins"]:
        # `on` unquoted parses as a boolean in YAML 1.1, so it must stay quoted.
        assert "on" in {str(k) for k in join} and True not in join
        assert join["source"] in m.TABLES.values()
        assert join["rely"]["at_most_one_match"] is True
    for item in spec["fields"] + spec["measures"]:
        assert item.get("display_name"), item["name"]
    for measure in spec["measures"]:
        assert measure.get("comment"), measure["name"]


def test_views_named_in_sql_match_the_library():
    for key, file_name in [("orders", "02_orders_metric_view.sql"), ("funnel", "03_funnel_metric_view.sql")]:
        assert f"CREATE OR REPLACE VIEW {m.VIEWS[key]}\n" in (GUIDE / file_name).read_text()


def test_window_measures_order_by_a_defined_field():
    spec = metric_view_yaml(GUIDE / "02_orders_metric_view.sql")
    fields = {f["name"] for f in spec["fields"]}
    windows = [x for x in spec["measures"] if "window" in x]
    assert len(windows) >= 3
    for measure in windows:
        for window in measure["window"]:
            assert window["order"] in fields
            assert window["semiadditive"] in {"first", "last"}
