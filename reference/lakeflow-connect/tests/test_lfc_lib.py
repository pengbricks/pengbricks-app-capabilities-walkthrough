from __future__ import annotations

import re
import sys
from decimal import Decimal
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import lfc_lib as l  # noqa: E402


def pipeline_tables() -> dict[str, dict]:
    spec = yaml.safe_load((ROOT / "resources" / "sqlserver.pipelines.yml").read_text())
    ingestion = spec["resources"]["pipelines"]["lfc_ingestion"]["ingestion_definition"]
    default = ingestion["table_configuration"]["scd_type"]
    tables = {}
    for item in ingestion["objects"]:
        table = item["table"]
        tables[table["source_table"]] = {
            "destination": table["destination_table"],
            "scd_type": (table.get("table_configuration") or {}).get("scd_type", default),
        }
    return tables


def test_pipeline_scd_types_match_the_source_capture() -> None:
    tables = pipeline_tables()
    assert {name: t["destination"] for name, t in tables.items()} == l.TABLES
    for name, capture in l.EXPECTED_CAPTURE.items():
        assert (tables[name]["scd_type"] == "SCD_TYPE_2") == (capture == "cdc"), name


def test_setup_script_enables_the_capture_each_table_needs() -> None:
    sql = (ROOT / "source" / "01_setup_source.sql").read_text()
    cdc = re.search(r"lakeflowSetupChangeDataCapture @Tables = '([^']+)'", sql).group(1)
    ct = re.search(r"lakeflowSetupChangeTracking\s+@Tables = '([^']+)'", sql).group(1)
    assert {t.removeprefix("dbo.") for t in cdc.split(",")} == {t for t, c in l.EXPECTED_CAPTURE.items() if c == "cdc"}
    assert {t.removeprefix("dbo.") for t in ct.split(",")} == {t for t, c in l.EXPECTED_CAPTURE.items() if c == "change_tracking"}


def test_auto_full_refresh_is_off() -> None:
    spec = yaml.safe_load((ROOT / "resources" / "sqlserver.pipelines.yml").read_text())
    config = spec["resources"]["pipelines"]["lfc_ingestion"]["ingestion_definition"]["table_configuration"]
    assert config["auto_full_refresh_policy"]["enabled"] is False


def test_full_refresh_task_never_names_the_history_table() -> None:
    job = yaml.safe_load((ROOT / "resources" / "lakeflow_connect.job.yml").read_text())
    tasks = job["resources"]["jobs"]["capability_guides_lakeflow_connect"]["tasks"]
    selections = [name for t in tasks for name in (t.get("pipeline_task") or {}).get("full_refresh_selection", [])]
    assert selections == ["lfc_orders"]
    assert all(not (t.get("pipeline_task") or {}).get("full_refresh") for t in tasks)


def test_capture_problems() -> None:
    ready = [
        {"table_name": "customers", "cdc_on": 1, "change_tracking_on": 0},
        {"table_name": "orders", "cdc_on": 0, "change_tracking_on": 1},
        {"table_name": "products", "cdc_on": 0, "change_tracking_on": 1},
    ]
    assert l.capture_problems(ready) == []
    both = [dict(ready[0], change_tracking_on=1), *ready[1:]]
    assert "drop history" in l.capture_problems(both)[0]
    assert "needs CDC" in l.capture_problems([dict(ready[0], cdc_on=0), *ready[1:]])[0]
    assert "missing" in l.capture_problems(ready[1:])[0]


def test_connection_string_validates_the_certificate() -> None:
    text = l.connection_string("db.example.com", 1433, "LakeflowDemo", "app", "p;w}d")
    assert "Encrypt=yes;TrustServerCertificate=no;" in text
    assert "Server=tcp:db.example.com,1433;" in text
    assert "Pwd={p;w}}d};" in text


def test_plans_rotate() -> None:
    assert [l.next_plan(p) for p in l.PLANS] == ["Standard", "Premium", "Basic"]


class FakeSource:
    """Answers the change-batch queries with fixed rows and records every statement."""

    def __init__(self) -> None:
        self.statements: list[tuple[str, tuple]] = []
        self.next_order = 5000

    def cursor(self):
        return self

    def execute(self, sql, params):
        self.statements.append((sql, params))
        self.description, self.rows = None, []
        if sql == l.PICK_CUSTOMERS_SQL:
            self.description, self.rows = [("customer_id",), ("plan_name",)], [(i, "Basic") for i in range(1, params[0] + 1)]
        elif sql in (l.PICK_SHIP_SQL, l.PICK_DELETE_SQL, l.PICK_CANCEL_SQL):
            base = {l.PICK_SHIP_SQL: 100, l.PICK_DELETE_SQL: 200, l.PICK_CANCEL_SQL: 300}[sql]
            self.description, self.rows = [("order_id",)], [(base + i,) for i in range(params[0])]
        elif sql == l.INSERT_ORDER_SQL:
            self.next_order += 1
            self.description, self.rows = [("order_id",)], [(self.next_order,)]

    def fetchall(self):
        return self.rows


def test_make_changes_returns_one_expectation_per_change() -> None:
    expected = l.make_changes(FakeSource(), plan_changes=3, inserts=10, ships=5, deletes=2)
    kinds = [e["kind"] for e in expected]
    assert kinds.count("update_history") == 3 and kinds.count("insert") == 10 and kinds.count("delete") == 2
    assert kinds.count("update") == 7  # 5 shipped + 2 cancelled
    assert {e["value"] for e in expected if e["kind"] == "update_history"} == {"Standard"}


def test_landing_sql_checks_history_and_deletes() -> None:
    history = l.landing_sql("main", "s", l.expectation("update_history", "customers", 7, "plan_name", "Premium"))
    assert "__END_AT IS NULL" in history and "__END_AT IS NOT NULL" in history and "`lfc_customers`" in history
    delete = l.landing_sql("main", "s", l.expectation("delete", "orders", 9))
    assert "count(*) = 0" in delete and "order_id = 9" in delete
    insert = l.landing_sql("main", "s", l.expectation("insert", "orders", 10, "status", "NEW"))
    assert "__END_AT" not in insert


def test_same_answer_ignores_order_and_number_types() -> None:
    expected = [("Basic", Decimal("120.5000"), 3), ("Premium", Decimal("80.0000"), 1)]
    assert l.same_answer(expected, [(1, 80.0, "Premium"), (3, 120.5, "Basic")])
    assert not l.same_answer(expected, [(3, 120.5, "Basic")])
    assert not l.same_answer(expected, [])
