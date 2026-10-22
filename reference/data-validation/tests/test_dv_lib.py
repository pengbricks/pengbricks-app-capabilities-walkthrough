from __future__ import annotations

import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import dv_lib as v  # noqa: E402

SPEC = v.load_spec(ROOT / "use_cases" / "general.yml")
TODAY = date(2026, 10, 20)
COLUMNS = v.columns_from_spec(SPEC["checksum_columns"]["orders"])


def test_the_shipped_spec_is_valid():
    assert v.validate_spec(SPEC) == []


def test_every_check_type_is_used_once_or_more():
    assert {c["type"] for c in SPEC["checks"]} == set(v.CHECK_TYPES)


def test_sample_orders_hold_the_planned_bad_rows():
    rows = v.order_rows(SPEC, TODAY)
    assert len(rows) == 1200
    assert len({r[0] for r in rows}) == 1200
    assert sum(1 for r in rows if r[4] < 0) == 12
    assert sum(1 for r in rows if r[1] is None) == 5
    assert sum(1 for r in rows if r[3] == "UNKNOWN") == 2
    assert min(r[2] for r in rows) == date(2026, 9, 21) and max(r[2] for r in rows) == TODAY


def test_every_order_customer_exists():
    customers = {c[0] for c in v.customer_rows(SPEC)}
    assert {r[1] for r in v.order_rows(SPEC, TODAY) if r[1] is not None} <= customers


def test_late_change_moves_orders_between_two_days():
    ids = v.late_change_ids(SPEC)
    assert len(ids) == 6
    by_id = {r[0]: r for r in v.order_rows(SPEC, TODAY)}
    assert {by_id[i][2] for i in ids} == {date(2026, 10, 15)}


def test_checksum_expressions_cover_every_column_in_both_dialects():
    pg = v.checksum_expr(COLUMNS, "postgres")
    spark = v.checksum_expr(COLUMNS, "spark")
    for column in COLUMNS:
        assert column.name in pg and column.name in spark
    assert "to_char(amount, 'FM9999999990.00')" in pg
    assert "CAST(CAST(amount AS DECIMAL(12,2)) AS STRING)" in spark


def test_aggregate_sql_for_a_whole_table_and_for_a_grain():
    whole = v.aggregate_sql("postgres", "dv_source.orders", ["row_count", "sum:amount", "distinct:order_id"], COLUMNS)
    assert whole == (
        "SELECT 'all' AS slice, count(*) AS row_count, coalesce(sum(amount), 0) AS sum_amount, "
        "count(distinct order_id) AS distinct_order_id FROM dv_source.orders"
    )
    daily = v.aggregate_sql("spark", "c.s.dv_orders_landed", ["row_count", "checksum"], COLUMNS, "order_date")
    assert daily.startswith("SELECT CAST(order_date AS STRING) AS slice, count(*) AS row_count, ")
    assert daily.endswith("FROM c.s.dv_orders_landed GROUP BY 1")


def test_metric_alias_rejects_unknown_metrics():
    assert v.metric_alias("sum:amount") == "sum_amount"
    with pytest.raises(ValueError):
        v.metric_alias("median:amount")
    with pytest.raises(ValueError):
        v.metric_alias("sum:amount; drop table x")


def test_identifiers_reject_sql():
    for bad in ("orders; DROP TABLE x", "a b", "1abc", "x.y", ""):
        with pytest.raises(ValueError):
            v.ident(bad)
    assert v.ident("dv_orders_silver") == "dv_orders_silver"


def test_to_slices_accepts_rows_and_dicts():
    class Row:
        def asDict(self):
            return {"slice": "2026-10-01", "row_count": 4, "sum_amount": Decimal("10.50")}

    got = v.to_slices([Row(), {"slice": "2026-10-02", "row_count": 5, "sum_amount": 1}], ["row_count", "sum:amount"])
    assert got["2026-10-01"] == {"row_count": Decimal(4), "sum_amount": Decimal("10.50")}
    assert got["2026-10-02"]["row_count"] == Decimal(5)


def test_diff_slices_finds_changed_and_missing_slices():
    source = {"a": {"row_count": Decimal(5)}, "b": {"row_count": Decimal(7)}, "c": {"row_count": Decimal(1)}}
    target = {"a": {"row_count": Decimal(5)}, "b": {"row_count": Decimal(4)}, "d": {"row_count": Decimal(1)}}
    found = v.diff_slices(source, target)
    assert [m["slice"] for m in found] == ["b", "c", "d"]
    assert found[0]["metrics"] == {"row_count": (Decimal(7), Decimal(4))}
    assert found[1]["missing"] == "target" and found[2]["missing"] == "source"
    assert "b: row_count source 7 vs target 4" in v.describe_mismatches(found)


def test_diff_slices_honours_the_tolerance():
    source = {"a": {"sum_amount": Decimal("10.00")}}
    target = {"a": {"sum_amount": Decimal("10.004")}}
    assert v.diff_slices(source, target) != []
    assert v.diff_slices(source, target, Decimal("0.01")) == []


def test_describe_mismatches_truncates():
    many = [{"slice": str(i), "missing": "target"} for i in range(9)]
    assert v.describe_mismatches(many, limit=3).endswith("and 6 more")


def test_passes_uses_the_operator_and_treats_none_as_failure():
    assert v.passes(0, "le", 0) and not v.passes(1, "le", 0)
    assert v.passes(1000, "ge", 1000) and not v.passes(999, "ge", 1000)
    assert not v.passes(None, "le", 0)


def result(name, severity, status):
    return v.Result(name, "row_count", "t", severity, 1.0, ">=", 1.0, status)


def test_blocking_follows_block_on():
    results = [result("a", "error", "pass"), result("b", "warn", "fail"), result("c", "error", "error"), result("d", "error", "fail")]
    assert [r.check_name for r in v.blocking(results, "error")] == ["c", "d"]
    assert [r.check_name for r in v.blocking(results, "warn")] == ["b", "c", "d"]
    assert v.blocking(results, "none") == []
    with pytest.raises(ValueError):
        v.blocking(results, "sometimes")


def test_validate_spec_reports_each_kind_of_mistake():
    spec = {
        "checks": [
            {"name": "a", "type": "row_count", "dataset": "t", "severity": "error", "threshold": 1},
            {"name": "a", "type": "row_count", "dataset": "t", "severity": "error", "threshold": 1},
            {"name": "b", "type": "nope", "severity": "error", "threshold": 1},
            {"name": "c", "type": "unique", "dataset": "t", "severity": "loud"},
            {"name": "d", "type": "reconciliation", "dataset": "t", "source_table": "o", "metrics": ["median:x"], "severity": "warn", "threshold": 0},
            {"name": "e", "type": "row_count", "dataset": "t", "severity": "warn", "threshold": 0, "op": "approx"},
        ]
    }
    problems = " | ".join(v.validate_spec(spec))
    for expected in ("a: duplicate name", "b: unknown type", "c: severity", "c: missing threshold", "c: unique needs columns", "d: unknown metric", "e: unknown op"):
        assert expected in problems


def test_single_value_sql_for_each_type():
    ns = "c.s"
    by_type = {c["type"]: c for c in SPEC["checks"] if c["type"] != "reconciliation"}
    assert v.single_value_sql(by_type["row_count"], ns) == "SELECT count(*) AS observed FROM c.s.dv_orders_silver"
    assert "GROUP BY order_id HAVING count(*) > 1" in v.single_value_sql(by_type["unique"], ns)
    assert "customer_id IS NULL" in v.single_value_sql(by_type["null_rate"], ns)
    ref = v.single_value_sql(by_type["referential"], ns)
    assert "LEFT ANTI JOIN c.s.dv_customers_landed r ON d.customer_id = r.customer_id" in ref
    assert "max(_loaded_at)" in v.single_value_sql(by_type["freshness"], ns)
    custom = v.single_value_sql(check("silver_plus_quarantine_equals_landed"), ns)
    assert "{ns}" not in custom and "c.s.dv_orders_silver" in custom


class FakeSpark:
    def __init__(self, value=None, rows=None, boom=None):
        self.value, self.rows, self.boom = value, rows or [], boom
        self.queries = []

    def sql(self, text):
        self.queries.append(text)
        if self.boom:
            raise self.boom
        return SimpleNamespace(first=lambda: {"observed": self.value}, collect=lambda: self.rows)


def context(spark, source_rows=None, snapshot=None):
    return v.Context(
        spark=spark, ns="c.s", source_schema="dv_source", checksum_columns=COLUMNS,
        remote=lambda sql: SimpleNamespace(collect=lambda: source_rows or []),
        snapshot=lambda name: snapshot or {},
    )


def check(name):
    return next(c for c in SPEC["checks"] if c["name"] == name)


def test_run_check_passes_and_fails_on_the_threshold():
    ok = v.run_check(check("silver_has_rows"), context(FakeSpark(value=1100)))
    assert (ok.status, ok.observed, ok.operator, ok.expected) == ("pass", 1100.0, ">=", 1000.0)
    low = v.run_check(check("silver_has_rows"), context(FakeSpark(value=10)))
    assert low.status == "fail"


def test_run_check_records_an_error_instead_of_raising():
    got = v.run_check(check("silver_has_rows"), context(FakeSpark(boom=RuntimeError("table not found\nmore"))))
    assert got.status == "error" and got.observed is None and got.details == "RuntimeError: table not found"


def test_run_check_flags_a_freshness_check_with_no_values():
    got = v.run_check(check("landed_fresh"), context(FakeSpark(value=None)))
    assert got.status == "fail" and got.details == "no values to measure"


def test_reconciliation_against_a_snapshot_counts_differing_days():
    target_rows = [
        {"slice": "2026-10-01", "row_count": 40, "sum_amount": Decimal("100.00"), "checksum": 11},
        {"slice": "2026-10-02", "row_count": 41, "sum_amount": Decimal("90.00"), "checksum": 22},
    ]
    snapshot = {
        "2026-10-01": {"row_count": Decimal(40), "sum_amount": Decimal("100.00"), "checksum": Decimal(11)},
        "2026-10-02": {"row_count": Decimal(40), "sum_amount": Decimal("80.00"), "checksum": Decimal(99)},
    }
    got = v.run_check(check("orders_daily_vs_source"), context(FakeSpark(rows=target_rows), snapshot=snapshot))
    assert (got.status, got.observed, got.severity) == ("fail", 1.0, "warn")
    assert "1 of 2 slices differ (snapshot source" in got.details and "2026-10-02" in got.details


def test_live_reconciliation_runs_the_source_query_and_passes_when_equal():
    rows = [{"slice": "all", "row_count": 1200, "sum_amount": Decimal("5.00"), "distinct_order_id": 1200}]
    asked = []
    ctx = context(FakeSpark(rows=rows), source_rows=rows)
    ctx.remote = lambda sql: asked.append(sql) or SimpleNamespace(collect=lambda: rows)
    got = v.run_check(check("orders_totals_vs_source"), ctx)
    assert got.status == "pass" and got.observed == 0.0
    assert asked and asked[0].endswith("FROM dv_source.orders")


def test_find_pipeline_id_needs_exactly_one_match():
    pipelines = [SimpleNamespace(name="[dev me] capability-guides-data-validation", pipeline_id="p1"), SimpleNamespace(name="other", pipeline_id="p2")]
    ws = SimpleNamespace(pipelines=SimpleNamespace(list_pipelines=lambda: pipelines))
    assert v.find_pipeline_id(ws, "capability-guides-data-validation") == "p1"
    with pytest.raises(ValueError):
        v.find_pipeline_id(ws, "missing")


def test_pipeline_rules_match_the_spec():
    """The pipeline file cannot read the YAML, so it repeats the rules. This keeps the two in step."""
    import ast

    source = (ROOT / "guides" / "data-validation-framework" / "pipeline" / "dv_orders.py").read_text()
    found = {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign) and node.targets[0].id in ("DROP_RULES", "WARN_RULES", "FAIL_RULES"):
            found[node.targets[0].id.split("_")[0].lower()] = ast.literal_eval(node.value)
    assert found == SPEC["pipeline"]


def test_remote_query_escapes_quotes():
    seen = []
    spark = SimpleNamespace(sql=lambda text: seen.append(text) or "df")
    assert v.remote_query(spark, "conn", "db", "SELECT 'all'   AS slice") == "df"
    assert seen == ["SELECT * FROM remote_query('conn', database => 'db', query => 'SELECT \\'all\\' AS slice')"]


def test_plain_drops_trailing_zeros_and_exponents():
    assert v.plain(Decimal("11903.600000000000000000")) == "11903.6"
    assert v.plain(Decimal("98259070185.000000")) == "98259070185"
    assert v.plain(Decimal("5E+1")) == "50"


def test_require_lakebase_project_names_the_create_command():
    import dv_lib

    from databricks.sdk.errors import NotFound

    def missing(name):
        raise NotFound(name)

    ws = SimpleNamespace(postgres=SimpleNamespace(get_project=missing))
    with pytest.raises(RuntimeError, match=r"capability-guides.*databricks postgres create-project capability-guides.*Nothing was changed"):
        dv_lib.require_lakebase_project(ws, "capability-guides")

    ok = SimpleNamespace(postgres=SimpleNamespace(get_project=lambda name: SimpleNamespace(name=name)))
    dv_lib.require_lakebase_project(ok, "capability-guides")
