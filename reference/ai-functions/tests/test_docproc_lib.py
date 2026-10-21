import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import docproc_lib as d  # noqa: E402


@pytest.fixture
def spec():
    return d.load_spec(str(ROOT / "use_cases" / "documents.yml"))


def test_spec_loads_with_four_types_and_unique_files(spec):
    docs = d.documents(spec)
    assert {x["doc_type"] for x in docs} == set(spec["classify"]["labels"])
    assert 20 <= len(docs) <= 40
    assert len({x["file"] for x in docs}) == len(docs)


def test_labels_must_match_extraction_types(spec):
    spec["classify"]["labels"]["memo"] = "A memo"
    with pytest.raises(ValueError, match="must match"):
        d.validate_spec(spec)


def test_required_fields_must_be_in_the_schema(spec):
    spec["extract"]["required"]["invoice"].append("nope")
    with pytest.raises(ValueError, match="not in the schema"):
        d.validate_spec(spec)


def test_table_names_are_checked(spec):
    spec["tables"]["raw"] = "x; DROP TABLE y"
    with pytest.raises(ValueError, match="identifier"):
        d.validate_spec(spec)


def test_invoice_lines_are_deterministic_and_total_matches_truth(spec):
    assert d.invoice_lines(5, "INV-1") == d.invoice_lines(5, "INV-1")
    docs = {x["file"]: x for x in d.documents(spec)}
    first = docs["INV-2001.pdf"]
    assert first["fields"]["total"] == d.a.invoice_total(first["source"])
    assert docs["INV-2009.pdf"]["fields"]["total"] is None and docs["INV-2009.pdf"]["expect_quarantine"]


def test_every_planted_value_is_in_the_rendered_source(spec):
    for doc in d.documents(spec):
        text = str(doc["source"])
        assert all(value in text for value in doc["planted"]), doc["file"]


def test_documents_render_to_pdf_and_long_ones_run_two_pages(tmp_path, spec):
    pytest.importorskip("fpdf")
    pytest.importorskip("PIL")
    for doc in d.documents(spec):
        path = tmp_path / doc["file"]
        d.render_document(doc, path)
        assert path.read_bytes().startswith(b"%PDF")
    long_invoice = (tmp_path / "INV-2007.pdf").read_bytes()
    short_invoice = (tmp_path / "INV-2001.pdf").read_bytes()
    assert long_invoice.count(b"/Type /Page\n") >= 2 or long_invoice.count(b"/Type /Page") > short_invoice.count(b"/Type /Page")


def test_receipts_render_the_same_bytes_every_time(tmp_path, spec):
    pytest.importorskip("PIL")
    receipt = next(x for x in d.documents(spec) if x["doc_type"] == "receipt")
    d.render_receipt(receipt["source"], tmp_path / "a.pdf")
    d.render_receipt(receipt["source"], tmp_path / "b.pdf")
    # The PDF header carries a creation date; compare the embedded image stream instead.
    image = lambda p: p.read_bytes().split(b"stream")[1]  # noqa: E731
    assert image(tmp_path / "a.pdf") == image(tmp_path / "b.pdf")


@pytest.mark.parametrize("value", ["2026-09-01", " 2026-09-01 "])
def test_valid_date_accepts_iso(value):
    assert d.valid_date(value)


@pytest.mark.parametrize("value", ["09/01/2026", "2026-13-01", "2026-02-30", None, 20260901])
def test_valid_date_rejects_other_shapes(value):
    assert not d.valid_date(value)


def test_validate_passes_a_clean_invoice(spec):
    fields = {"invoice_number": ("INV-1", 0.95), "vendor": ("Acme", 0.9), "invoice_date": ("2026-09-01", 0.9), "total": (120.5, 0.92)}
    assert d.validate_fields("invoice", fields, spec) == []


def test_validate_flags_null_low_confidence_and_bad_values(spec):
    fields = {"invoice_number": ("INV-1", 0.95), "vendor": ("Acme", 0.5), "invoice_date": ("1 Sept", 0.9), "total": (None, None)}
    reasons = d.validate_fields("invoice", fields, spec)
    assert "total is missing" in reasons
    assert any("vendor confidence 0.50" in r for r in reasons)
    assert any("invoice_date" in r and "YYYY-MM-DD" in r for r in reasons)


def test_validate_flags_out_of_range_amounts(spec):
    fields = {"merchant": ("Shop", 0.9), "receipt_date": ("2026-09-01", 0.9), "total": (-4.0, 0.9)}
    assert any("outside" in r for r in d.validate_fields("receipt", fields, spec))


def test_validate_without_confidence_scores_checks_only_nulls(spec):
    fields = {"merchant": ("Shop", None), "receipt_date": ("2026-09-01", None), "total": (4.0, None)}
    assert d.validate_fields("receipt", fields, spec) == []


def test_value_matches_by_field_type():
    assert d.value_matches("total", "number", 358.5, "358.50")
    assert not d.value_matches("total", "number", 358.5, 359)
    assert d.value_matches("invoice_date", "string", "2026-09-02", "2026-09-02T00:00:00")
    assert d.value_matches("vendor", "string", "Alder Supply Co.", "alder supply co")
    assert d.value_matches("total", "number", None, None)
    assert not d.value_matches("total", "number", None, 12)


def test_per_unit_and_extrapolate():
    assert d.per_unit(2.0, 4) == 0.5
    assert d.per_unit(None, 4) is None and d.per_unit(2.0, 0) is None
    assert d.extrapolate(0.01, 100_000) == pytest.approx(1000)
    assert d.extrapolate(0.01, 100_000, growth=0.2, reprocess=0.1) == pytest.approx(1000 * 1.2 * 1.1)


def test_billing_status():
    from datetime import datetime

    end = datetime(2026, 10, 21, 12, 0)
    assert d.billing_status(0, None, end) == "not_available"
    assert d.billing_status(3, datetime(2026, 10, 21, 11, 30), end) == "partial"
    assert d.billing_status(3, None, end) == "partial"
    assert d.billing_status(3, datetime(2026, 10, 21, 12, 10), end) == "complete"
