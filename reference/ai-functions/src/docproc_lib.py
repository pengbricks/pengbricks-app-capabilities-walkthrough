"""Helpers for the document processing guide: sample documents, validation, scoring, and billing math.

Everything here runs without Spark, so the pure parts are unit-tested. The notebooks call these and keep
the SQL (Auto Loader, ai_parse_document, ai_classify, ai_extract, ai_mask) in plain view.
"""

from __future__ import annotations

import io
import random
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml

import aif_lib as a

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


# --- spec ---------------------------------------------------------------------------------------
def load_spec(path: str) -> dict[str, Any]:
    with open(path) as handle:
        spec = yaml.safe_load(handle)
    validate_spec(spec)
    return spec


def validate_spec(spec: dict[str, Any]) -> None:
    for name in [*spec["tables"].values(), spec["volume"], spec["landing_folder"]]:
        if not _IDENT.match(name):
            raise ValueError(f"Not a valid identifier: {name}")
    labels = set(spec["classify"]["labels"])
    types = set(spec["extract"]["schemas"])
    if labels != types:
        raise ValueError(f"Classification labels {sorted(labels)} must match the extraction types {sorted(types)}")
    for doc_type, required in spec["extract"]["required"].items():
        unknown = set(required) - set(spec["extract"]["schemas"][doc_type])
        if unknown:
            raise ValueError(f"{doc_type}: required fields not in the schema: {sorted(unknown)}")
    for field_schema in (f for fields in spec["extract"]["schemas"].values() for f in fields.values()):
        if field_schema["type"] not in ("string", "number"):
            raise ValueError(f"Unsupported field type: {field_schema['type']}")
    files = [d["file"] for d in documents(spec)]
    if len(files) != len(set(files)):
        raise ValueError("Two documents share a file name")


# --- documents ----------------------------------------------------------------------------------
_ITEMS = ["Paper, A4, 10 reams", "Toner cartridge", "Nitrile gloves, case", "Sensor module", "Mounting kit", "Shipping label roll",
          "Desk lamp", "Safety vest", "Storage bin", "Cable ties, pack", "Whiteboard markers", "Filter cartridge", "Hand sanitizer, case",
          "Packing tape", "Laminating pouches"]


def invoice_lines(count: int, number: str) -> list[tuple[str, int, float]]:
    """Deterministic line items for an invoice: the same number always gives the same lines."""
    rng = random.Random(number)
    return [(f"{_ITEMS[i % len(_ITEMS)]} #{i + 1}", rng.randint(1, 12), round(rng.uniform(4, 180), 2)) for i in range(count)]


def documents(spec: dict[str, Any]) -> list[dict[str, Any]]:
    """One record per sample document: its file name, true type, true field values, and what to expect."""
    out: list[dict[str, Any]] = []
    for inv in spec["invoices"]:
        invoice = {"number": inv["number"], "vendor": inv["vendor"], "date": inv["date"], "lines": invoice_lines(inv["lines"], inv["number"])}
        total = None if inv.get("drop_total") else a.invoice_total(invoice)
        out.append({"file": f"{inv['number']}.pdf", "doc_type": "invoice", "source": invoice, "drop_total": bool(inv.get("drop_total")),
                    "fields": {"invoice_number": inv["number"], "vendor": inv["vendor"], "invoice_date": inv["date"], "total": total},
                    "planted": [], "expect_quarantine": bool(inv.get("expect_quarantine"))})
    for f in spec["forms"]:
        out.append({"file": f"{f['request_id']}.pdf", "doc_type": "intake_form", "source": f, "drop_total": False,
                    "fields": {"request_id": f["request_id"], "applicant_name": f["name"], "request_date": None if f.get("drop_date") else f["date"],
                               "category": f["category"], "amount_requested": f["amount"]},
                    "planted": [f["name"], f["email"], f["phone"]], "expect_quarantine": bool(f.get("expect_quarantine"))})
    for item in spec["letters"]:
        out.append({"file": f"{item['id']}.pdf", "doc_type": "letter", "source": item, "drop_total": False,
                    "fields": {"sender_org": item["sender"], "letter_date": item["date"], "subject": item["subject"], "action_requested": item["action"]},
                    "planted": [item["signer"], item["phone"]], "expect_quarantine": bool(item.get("expect_quarantine"))})
    for r in spec["receipts"]:
        out.append({"file": f"{r['id']}.pdf", "doc_type": "receipt", "source": r, "drop_total": False,
                    "fields": {"merchant": r["merchant"], "receipt_date": r["date"], "total": r["total"]},
                    "planted": [], "expect_quarantine": bool(r.get("expect_quarantine"))})
    return out


def render_document(doc: dict[str, Any], path: str | Path) -> None:
    kind = doc["doc_type"]
    if kind == "invoice":
        render_invoice(doc, path)
    elif kind == "intake_form":
        render_form(doc["source"], path)
    elif kind == "letter":
        render_letter(doc["source"], path)
    else:
        render_receipt(doc["source"], path)


def render_invoice(doc: dict[str, Any], path: str | Path) -> None:
    """aif_lib's invoice layout, but a long invoice runs over to a second page, and a damaged one has no total line."""
    from fpdf import FPDF

    invoice = doc["source"]
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, invoice["vendor"], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 7, f"Invoice number: {invoice['number']}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, f"Invoice date: {invoice['date']}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, "Bill to: Example Retail Co., 100 Example Street", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 11)
    for header, width in (("Description", 100), ("Qty", 25), ("Unit price", 30), ("Amount", 35)):
        pdf.cell(width, 8, header, border=1)
    pdf.ln()
    pdf.set_font("Helvetica", "", 11)
    for description, qty, price in invoice["lines"]:
        pdf.cell(100, 8, description, border=1)
        pdf.cell(25, 8, str(qty), border=1, align="R")
        pdf.cell(30, 8, f"{price:,.2f}", border=1, align="R")
        pdf.cell(35, 8, f"{qty * price:,.2f}", border=1, align="R")
        pdf.ln()
    if not doc["drop_total"]:
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(155, 10, "Total due (USD)", align="R")
        pdf.cell(35, 10, f"{a.invoice_total(invoice):,.2f}", align="R")
    pdf.output(str(path))


def render_form(form: dict[str, Any], path: str | Path) -> None:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "Service Request Form", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, "Submit one form per request. Fields marked * are required.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    rows = [("Request ID *", form["request_id"]), ("Applicant name *", form["name"]),
            ("Date of request *", "" if form.get("drop_date") else form["date"]), ("Category *", form["category"]),
            ("Amount requested (USD)", f"{form['amount']:,.2f}"), ("Email", form["email"]), ("Phone", form["phone"])]
    for label, value in rows:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(60, 10, label, border=1)
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(110, 10, value, border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, "I confirm the information above is correct and that I am authorized to submit this request.")
    pdf.output(str(path))


_FILLER = ("We are writing about our ongoing arrangement and the steps both teams need to take. Please review the details below "
           "and let us know if anything needs to change before the next cycle. Our records show the previous cycle closed without issue, "
           "and we want the next one to follow the same schedule.")


def render_letter(letter: dict[str, Any], path: str | Path) -> None:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 9, letter["sender"], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 6, "100 Example Street, Example City", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.cell(0, 6, letter["date"], new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.cell(0, 6, f"To: {letter['recipient']}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, f"Subject: {letter['subject']}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.ln(2)
    pdf.multi_cell(0, 6, "To whom it may concern,")
    for i in range(int(letter.get("paragraphs", 2))):
        pdf.ln(2)
        pdf.multi_cell(0, 6, _FILLER if i else f"{_FILLER} {letter['action']}.")
    pdf.ln(4)
    pdf.multi_cell(0, 6, f"Please reply to {letter['signer']} at {letter['phone']}.")
    pdf.ln(6)
    pdf.multi_cell(0, 6, f"Sincerely,\n{letter['signer']}\n{letter['sender']}")
    pdf.output(str(path))


def render_receipt(receipt: dict[str, Any], path: str | Path) -> None:
    """A scanned receipt: text drawn onto a noisy, slightly rotated image and embedded as an image-only PDF,
    so there is no text layer and the parser has to use OCR. A `degrade` receipt is also faint and tilted."""
    from fpdf import FPDF
    from PIL import Image, ImageDraw, ImageFont

    rng = random.Random(receipt["id"])
    bad = bool(receipt.get("degrade"))
    width, height = 700, 900
    paper, ink = ((205, 205, 200), (150, 150, 150)) if bad else ((250, 250, 246), (20, 20, 20))
    image = Image.new("RGB", (width, height), paper)
    draw = ImageDraw.Draw(image)
    big, small = ImageFont.load_default(size=38), ImageFont.load_default(size=26)
    y = 50
    draw.text((width // 2, y), receipt["merchant"].upper(), font=big, fill=ink, anchor="mt")
    y += 90
    for text in ("123 Example Street", f"Date: {receipt['date']}", f"Receipt: {receipt['id']}", "-" * 34):
        draw.text((60, y), text, font=small, fill=ink)
        y += 44
    items = [("Item A", 0.38), ("Item B", 0.27), ("Item C", 0.35)]
    spent = 0.0
    for name, share in items:
        price = round(receipt["total"] * share, 2)
        spent += price
        draw.text((60, y), name, font=small, fill=ink)
        draw.text((width - 60, y), f"{price:.2f}", font=small, fill=ink, anchor="ra")
        y += 44
    y += 10
    draw.text((60, y), "TOTAL (USD)", font=big, fill=ink)
    draw.text((width - 60, y), f"{receipt['total']:.2f}", font=big, fill=ink, anchor="ra")
    pixels = image.load()
    amount = 55 if bad else 14
    for _ in range(width * height // (3 if bad else 12)):
        x, yy = rng.randrange(width), rng.randrange(height)
        shift = rng.randint(-amount, amount)
        r, g, b = pixels[x, yy]
        pixels[x, yy] = (max(0, min(255, r + shift)), max(0, min(255, g + shift)), max(0, min(255, b + shift)))
    image = image.rotate(4.0 if bad else 1.2, expand=True, fillcolor=paper)
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=55 if bad else 80)
    buffer.seek(0)
    pdf = FPDF()
    pdf.add_page()
    pdf.image(buffer, x=20, y=15, w=170)
    pdf.output(str(path))


# --- checks -------------------------------------------------------------------------------------
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def valid_date(value: Any) -> bool:
    if not isinstance(value, str) or not _ISO_DATE.match(value.strip()):
        return False
    try:
        date.fromisoformat(value.strip())
    except ValueError:
        return False
    return True


def value_matches(field: str, spec_type: str, expected: Any, actual: Any) -> bool:
    """Numbers within one cent, dates exactly, other text equal after dropping case, spaces, and punctuation."""
    if expected is None:
        return actual is None or str(actual).strip() == ""
    if actual is None or str(actual).strip() == "":
        return False
    if spec_type == "number":
        try:
            return abs(float(actual) - float(expected)) < 0.01
        except (TypeError, ValueError):
            return False
    if field.endswith("date"):
        return str(actual).strip()[:10] == str(expected)
    squash = lambda v: re.sub(r"[^a-z0-9]", "", str(v).lower())  # noqa: E731
    return squash(expected) == squash(actual) or (len(squash(expected)) > 12 and squash(expected) in squash(actual))


def validate_fields(doc_type: str, fields: dict[str, tuple[Any, float | None]], spec: dict[str, Any]) -> list[str]:
    """Reasons a document fails validation; an empty list means it passes. `fields` maps name to (value, confidence)."""
    reasons: list[str] = []
    threshold = float(spec["extract"]["min_confidence"])
    for name in spec["extract"]["required"][doc_type]:
        value, confidence = fields.get(name, (None, None))
        if value is None or str(value).strip() == "":
            reasons.append(f"{name} is missing")
        elif confidence is not None and confidence < threshold:
            reasons.append(f"{name} confidence {confidence:.2f} is below {threshold:g}")
    for name, field_schema in spec["extract"]["schemas"][doc_type].items():
        value, _ = fields.get(name, (None, None))
        if value is None or str(value).strip() == "":
            continue
        if name.endswith("date") and not valid_date(value):
            reasons.append(f"{name} {value!r} is not a YYYY-MM-DD date")
        if field_schema["type"] == "number":
            try:
                if not 0 < float(value) <= float(spec["validate"]["max_total"]):
                    reasons.append(f"{name} {value} is outside 0 to {spec['validate']['max_total']}")
            except (TypeError, ValueError):
                reasons.append(f"{name} {value!r} is not a number")
    return reasons


# --- extraction SQL -----------------------------------------------------------------------------
def schema_json(fields: dict[str, Any]) -> str:
    import json

    return json.dumps({name: {"type": f["type"], "description": f["description"]} for name, f in fields.items()})


# --- cost math ----------------------------------------------------------------------------------
def per_unit(total: float | None, units: float) -> float | None:
    """total / units, or None when there is nothing to divide by or no total yet."""
    if total is None or not units:
        return None
    return total / units


def extrapolate(per_page: float, pages_per_year: float, growth: float = 0.0, reprocess: float = 0.0) -> float:
    """Annual AI Functions cost: per-page cost x yearly pages x (1 + growth) x (1 + share of pages parsed again)."""
    return per_page * pages_per_year * (1 + growth) * (1 + reprocess)


def billing_status(row_count: int, watermark: datetime | None, run_end: datetime) -> str:
    """Whether the run's billing is in system.billing.usage yet.

    `watermark` is the newest usage_end_time the workspace has in the table. Billing lands in the table
    hours after the work, so rows can exist for the start of a run while its end is still missing.
    """
    if row_count == 0:
        return "not_available"
    if watermark is None or watermark < run_end:
        return "partial"
    return "complete"


# --- run log ------------------------------------------------------------------------------------
RUN_LOG_DDL = ("run_id string, step string, started_at timestamp, ended_at timestamp, seconds double, "
               "documents long, pages long, input_chars long, note string")


def log_step(spark, table: str, run_id: str, step: str, started: datetime, ended: datetime,
             documents: int = 0, pages: int = 0, input_chars: int = 0, note: str = "") -> None:
    """Record when a step ran and how much it processed. A rerun of the same step in the same run replaces its row."""
    spark.sql(f"CREATE TABLE IF NOT EXISTS {table} ({RUN_LOG_DDL})")
    spark.sql(f"DELETE FROM {table} WHERE run_id = {a.sql_string(run_id)} AND step = {a.sql_string(step)}")
    frame = spark.createDataFrame(
        [(run_id, step, started, ended, (ended - started).total_seconds(), int(documents), int(pages), int(input_chars), note)],
        RUN_LOG_DDL,
    )
    frame.write.mode("append").saveAsTable(table)
