import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import aif_lib as a  # noqa: E402


@pytest.fixture
def spec():
    return a.load_spec(str(ROOT / "use_cases" / "general.yml"))


def test_spec_is_valid_and_every_label_is_used(spec):
    used = {t["category"] for t in spec["tickets"]}
    assert used == set(spec["triage"]["labels"])


def test_ticket_category_must_be_a_label(spec):
    spec["tickets"][0]["category"] = "refund"
    with pytest.raises(ValueError, match="not in the label set"):
        a.validate_spec(spec)


def test_planted_values_must_appear_in_the_note(spec):
    spec["call_notes"][0]["planted"].append("Someone Else")
    with pytest.raises(ValueError, match="planted"):
        a.validate_spec(spec)


def test_endpoint_name_is_checked(spec):
    spec["translate"]["endpoint"] = "x'; DROP TABLE t; --"
    with pytest.raises(ValueError, match="endpoint"):
        a.validate_spec(spec)


def test_invoice_total_and_pdf(tmp_path, spec):
    invoice = spec["invoices"][0]
    assert a.invoice_total(invoice) == 358.5
    pytest.importorskip("fpdf")
    path = tmp_path / "inv.pdf"
    a.render_invoice_pdf(invoice, path)
    assert path.read_bytes().startswith(b"%PDF")


def test_leaked_is_case_insensitive():
    assert a.leaked("Call [MASKED] or JORDAN@example.com", ["Jordan Avery", "jordan@example.com"]) == ["jordan@example.com"]
    assert a.leaked(None, ["x"]) == []


def test_match_scores():
    scores = a.match_scores({("A", "1"), ("B", "9")}, {("A", "1"), ("C", "3")})
    assert scores["precision"] == 0.5 and scores["recall"] == 0.5 and scores["false_matches"] == 1


def test_accuracy_ignores_case_and_none():
    assert a.accuracy([("billing", "Billing "), ("outage", None)]) == 0.5
    assert a.accuracy([]) == 0.0


def test_sql_string_escapes_quotes():
    assert a.sql_string("it's") == "'it\\'s'"


def test_daily_orders_sql_covers_each_region(spec):
    sql = a.daily_orders_sql(spec)
    assert "'east' AS region" in sql and "'west' AS region" in sql
    assert "DATE'2025-01-01'" in sql


def test_forecast_sql_dates_match_the_spec(spec):
    sql = (ROOT / "guides" / "ai-functions" / "06_forecast.sql").read_text()
    assert f"DATE'{spec['forecast']['horizon']}'" in sql
    assert f"DATE'{spec['forecast']['end']}'" in sql
    assert set(spec["forecast"]["regions"]) == {"east", "west"}


def test_decide_questions_are_json_and_ids_exist(spec):
    spec["triage"]["decide"]["service_down_ids"].append(99)
    with pytest.raises(ValueError, match="unknown tickets"):
        a.validate_spec(spec)
