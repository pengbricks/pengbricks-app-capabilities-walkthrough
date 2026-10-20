import hashlib
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


def test_scan_expectations_must_be_schema_fields(spec):
    spec["scans"]["documents"][0]["expected"]["author_age"] = "63"
    with pytest.raises(ValueError, match="not in the scan schema"):
        a.validate_spec(spec)


def test_scan_file_names_are_checked(spec):
    spec["scans"]["documents"][0]["file"] = "../escape.pdf"
    with pytest.raises(ValueError, match="Scan file names"):
        a.validate_spec(spec)


def test_field_matches_dates_exactly_and_text_loosely():
    assert a.field_matches("document_date", "1880-01-27", "1880-01-27")
    assert not a.field_matches("document_date", "1880-01-27", "1886-01-17")
    assert a.field_matches("patent_number", "223898", "No. 223,898")
    assert not a.field_matches("patent_number", "223898", "223,996")
    assert a.field_matches("recipient", "Roosevelt", "Mrs. Franklin D. Roosevelt")
    assert not a.field_matches("sender", "Truman", None)
    assert not a.field_matches("sender", "Truman", "  ")


def _scan(tmp_path, body):
    source = tmp_path / "source.pdf"
    source.write_bytes(body)
    return {"file": "scan.pdf", "url": source.as_uri(), "sha256": hashlib.sha256(body).hexdigest()}


def test_fetch_document_downloads_once_and_verifies(tmp_path):
    doc = _scan(tmp_path, b"%PDF-1.4 scan")
    path, downloaded = a.fetch_document(doc, tmp_path / "public")
    assert downloaded and path.read_bytes() == b"%PDF-1.4 scan"
    again, downloaded = a.fetch_document(doc, tmp_path / "public")
    assert again == path and not downloaded


def test_fetch_document_rejects_a_wrong_checksum_and_keeps_nothing(tmp_path):
    doc = _scan(tmp_path, b"%PDF-1.4 scan")
    doc["sha256"] = "0" * 64
    with pytest.raises(RuntimeError, match="does not match"):
        a.fetch_document(doc, tmp_path / "public")
    assert list((tmp_path / "public").iterdir()) == []


def test_jpeg_size_reads_the_frame_header():
    # SOI, an APP0 segment, then a baseline SOF0 frame header for 640 x 480.
    data = b"\xff\xd8" + b"\xff\xe0\x00\x04ab" + b"\xff\xc0\x00\x0b\x08\x01\xe0\x02\x80\x01\x01\x11\x00"
    assert a.jpeg_size(data) == (640, 480)
    with pytest.raises(ValueError):
        a.jpeg_size(b"PNG")


def _jpeg(width, height):
    image = pytest.importorskip("PIL.Image")
    import io

    out = io.BytesIO()
    image.new("RGB", (width, height), "white").save(out, "JPEG")
    return out.getvalue()


def test_shrink_jpeg_resizes_wide_pages_only():
    big = _jpeg(1400, 1800)
    small = a.shrink_jpeg(big, 420)
    assert a.jpeg_size(small) == (420, 540) and len(small) < len(big)
    narrow = _jpeg(300, 400)
    assert a.shrink_jpeg(narrow, 420) == narrow


def test_page_overlay_scales_boxes_and_escapes_text():
    out = a.page_overlay_html(_jpeg(1000, 1200), 1000, [
        {"type": "text", "confidence": 0.9, "content": "<b>x</b> & y", "coord": [100, 200, 300, 400]}], show_px=500)
    assert "left:50px;top:100px;width:100px;height:100px" in out
    assert "&lt;b&gt;x&lt;/b&gt; &amp; y" in out and "<b>x</b>" not in out
