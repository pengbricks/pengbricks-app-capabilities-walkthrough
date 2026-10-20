"""Helpers for the AI Functions guide: spec loading, sample files, scoring, and the results table."""

from __future__ import annotations

import base64
import hashlib
import html
import json
import re
import shutil
import urllib.request
from pathlib import Path
from typing import Any

import yaml

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_ENDPOINT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")


# --- spec ---------------------------------------------------------------------------------------
def load_spec(path: str) -> dict[str, Any]:
    with open(path) as handle:
        spec = yaml.safe_load(handle)
    validate_spec(spec)
    return spec


def validate_spec(spec: dict[str, Any]) -> None:
    for name in [*spec["tables"].values(), spec["volume"]]:
        if not _IDENT.match(name):
            raise ValueError(f"Not a valid identifier: {name}")
    if not _ENDPOINT.match(spec["translate"]["endpoint"]):
        raise ValueError(f"Not an endpoint name: {spec['translate']['endpoint']}")
    labels = spec["triage"]["labels"]
    if len(set(labels)) != len(labels) or not 2 <= len(labels) <= 500:
        raise ValueError("Triage labels must be 2 to 500 unique values")
    unknown = {t["category"] for t in spec["tickets"]} - set(labels)
    if unknown:
        raise ValueError(f"Ticket categories not in the label set: {sorted(unknown)}")
    decide = spec["triage"]["decide"]
    json.loads(decide["questions"])  # ai_decide needs a JSON object of questions
    unknown_ids = set(decide["service_down_ids"]) - {t["id"] for t in spec["tickets"]}
    if unknown_ids:
        raise ValueError(f"ai_decide expectations name unknown tickets: {sorted(unknown_ids)}")
    for note in spec["call_notes"]:
        missing = [value for value in note["planted"] if value not in note["note"]]
        if missing:
            raise ValueError(f"Call note {note['id']} does not contain its planted values: {missing}")
    if not 0 <= float(spec["scans"]["min_confidence"]) <= 1:
        raise ValueError("scans.min_confidence must be between 0 and 1")
    scan_fields = set(json.loads(spec["scans"]["schema"]))
    for doc in spec["scans"]["documents"]:
        if not re.match(r"^[a-z0-9][a-z0-9.-]*\.pdf$", doc["file"]):
            raise ValueError(f"Scan file names are lowercase, dot or dash, and end in .pdf: {doc['file']}")
        if not re.match(r"^[0-9a-f]{64}$", doc["sha256"]):
            raise ValueError(f"{doc['file']}: sha256 must be 64 hex characters")
        unknown_fields = set(doc["expected"]) - scan_fields
        if unknown_fields:
            raise ValueError(f"{doc['file']}: expected fields not in the scan schema: {sorted(unknown_fields)}")
    accounts = {a["id"] for a in spec["accounts"]}
    vendors = {v["id"] for v in spec["vendors"]}
    for account, vendor in spec["matches"]:
        if account not in accounts or vendor not in vendors:
            raise ValueError(f"Match {account}-{vendor} names an unknown account or vendor")


def fq(catalog: str, schema: str, name: str) -> str:
    return f"`{catalog}`.`{schema}`.`{name}`"


def sql_string(value: str) -> str:
    """A single-quoted SQL string literal."""
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


# --- invoices -----------------------------------------------------------------------------------
def invoice_total(invoice: dict[str, Any]) -> float:
    return round(sum(qty * price for _, qty, price in invoice["lines"]), 2)


def render_invoice_pdf(invoice: dict[str, Any], path: str | Path) -> None:
    """Write a one-page invoice PDF. The layout is plain on purpose: a header, a line table, a total."""
    from fpdf import FPDF

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
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(155, 10, "Total due (USD)", align="R")
    pdf.cell(35, 10, f"{invoice_total(invoice):,.2f}", align="R")
    pdf.output(str(path))


# --- public scans -------------------------------------------------------------------------------
USER_AGENT = "databricks-capability-guides/1.0 (AI Functions guide; https://github.com/pengbricks/pengbricks-app-capabilities-walkthrough)"


def sha256_of(path: str | Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch_document(doc: dict[str, Any], folder: str | Path) -> tuple[Path, bool]:
    """Download a pinned scan into `folder` once and verify it. Returns (path, downloaded).

    A verified file already in place is kept and nothing is downloaded, so reruns are cheap and
    give the same bytes. A file with the wrong hash is replaced; a bad download is deleted, never kept.
    """
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / doc["file"]
    if target.exists() and sha256_of(target) == doc["sha256"]:
        return target, False
    partial = folder / (doc["file"] + ".partial")
    request = urllib.request.Request(doc["url"], headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response, open(partial, "wb") as handle:
        shutil.copyfileobj(response, handle)
    actual = sha256_of(partial)
    if actual != doc["sha256"]:
        partial.unlink()
        raise RuntimeError(f"{doc['file']}: downloaded SHA-256 {actual} does not match the pinned {doc['sha256']}")
    partial.replace(target)
    return target, True


def _squash(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def field_matches(field: str, expected: str, actual: Any) -> bool:
    """`*date` fields must be the same ISO date; any other field must contain the expected text,
    ignoring case, spaces, and punctuation (so 223,898 matches 223898)."""
    if actual is None or str(actual).strip() == "":
        return False
    if field.endswith("date"):
        return str(actual).strip()[:10] == str(expected)
    return _squash(expected) in _squash(actual)


def jpeg_size(data: bytes) -> tuple[int, int]:
    """(width, height) from a JPEG's frame header, without an imaging library."""
    if data[:2] != b"\xff\xd8":
        raise ValueError("Not a JPEG")
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = int.from_bytes(data[i + 2 : i + 4], "big")
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            return int.from_bytes(data[i + 7 : i + 9], "big"), int.from_bytes(data[i + 5 : i + 7], "big")
        i += 2 + length
    raise ValueError("No JPEG frame header found")


# Element types ai_parse_document returns, with the outline color used in the page view.
ELEMENT_COLORS = {
    "title": "#d62728", "section_header": "#d62728", "text": "#1f77b4", "table": "#2ca02c",
    "figure": "#9467bd", "caption": "#8c564b", "signature": "#ff7f0e", "page_header": "#7f7f7f",
    "page_footer": "#7f7f7f", "page_number": "#7f7f7f",
}


def page_overlay_html(image: bytes, width_px: int, elements: list[dict[str, Any]], show_px: int = 560) -> str:
    """One page image with a box around every element ai_parse_document found on it.

    `elements` are dicts with type, confidence, content, and coord ([x0, y0, x1, y1] in the page
    image's pixels). Hovering a box shows the element's type, confidence, and text.
    """
    image = shrink_jpeg(image, show_px)
    scale = show_px / width_px
    boxes = []
    for e in elements:
        x0, y0, x1, y1 = (float(c) * scale for c in e["coord"])
        color = ELEMENT_COLORS.get(e["type"], "#17becf")
        tip = html.escape(f"{e['type']} ({float(e['confidence'] or 0):.2f}): {(e['content'] or '')[:300]}")
        boxes.append(
            f'<div title="{tip}" style="position:absolute;left:{x0:.0f}px;top:{y0:.0f}px;width:{x1 - x0:.0f}px;'
            f'height:{y1 - y0:.0f}px;border:2px solid {color};background:{color}14"></div>'
        )
    src = "data:image/jpeg;base64," + base64.b64encode(image).decode()
    return (
        f'<div style="position:relative;display:inline-block;width:{show_px}px;vertical-align:top;margin:0 12px 12px 0;'
        f'border:1px solid #ddd"><img src="{src}" style="width:{show_px}px;display:block">{"".join(boxes)}</div>'
    )


def shrink_jpeg(image: bytes, width_px: int, quality: int = 75) -> bytes:
    """The page image resized to the width it is shown at. Full-size scans run to hundreds of KB
    each, and a notebook drops a cell's output past its size limit, so every page is shrunk first."""
    import io

    from PIL import Image

    with Image.open(io.BytesIO(image)) as page:
        if page.width <= width_px:
            return image
        small = page.convert("RGB").resize((width_px, round(page.height * width_px / page.width)), Image.LANCZOS)
        out = io.BytesIO()
        small.save(out, "JPEG", quality=quality, optimize=True)
        return out.getvalue()


def legend_html() -> str:
    items = "".join(
        f'<span style="margin-right:12px"><span style="display:inline-block;width:10px;height:10px;'
        f'border:2px solid {color};margin-right:4px"></span>{name}</span>'
        for name, color in ELEMENT_COLORS.items()
        if name not in ("page_footer", "page_number", "section_header")
    )
    return f'<p style="font:13px sans-serif">{items} Hover a box for its type, confidence, and text.</p>'


# --- scoring ------------------------------------------------------------------------------------
def leaked(masked: str | None, planted: list[str]) -> list[str]:
    """Planted personal values that are still in the masked text."""
    text = masked or ""
    return [value for value in planted if value.lower() in text.lower()]


def match_scores(predicted: set[tuple[str, str]], expected: set[tuple[str, str]]) -> dict[str, float]:
    hits = len(predicted & expected)
    return {
        "true_matches": float(hits),
        "false_matches": float(len(predicted - expected)),
        "missed_matches": float(len(expected - predicted)),
        "precision": hits / len(predicted) if predicted else 0.0,
        "recall": hits / len(expected) if expected else 0.0,
    }


def accuracy(pairs: list[tuple[Any, Any]]) -> float:
    """Share of (expected, actual) pairs that agree, ignoring case and surrounding space."""
    if not pairs:
        return 0.0
    norm = lambda v: str(v).strip().lower() if v is not None else None  # noqa: E731
    return sum(norm(e) == norm(a) for e, a in pairs) / len(pairs)


# --- forecast data ------------------------------------------------------------------------------
def daily_orders_sql(spec: dict[str, Any]) -> str:
    """Daily orders per region: base x (1 + 0.25 sin(weekday)) x (1 + 0.0005 x day), rounded. No randomness."""
    f = spec["forecast"]
    regions = " UNION ALL ".join(
        f"SELECT {sql_string(name)} AS region, {float(base)} AS base" for name, base in f["regions"].items()
    )
    return f"""
SELECT d AS order_date, r.region,
       CAST(round(r.base * (1 + 0.25 * sin(2 * pi() * dayofweek(d) / 7))
                  * (1 + 0.0005 * datediff(d, DATE'{f['start']}'))) AS INT) AS orders
FROM (SELECT explode(sequence(DATE'{f['start']}', DATE'{f['end']}', INTERVAL 1 DAY)) AS d)
CROSS JOIN ({regions}) r
"""


# --- results ------------------------------------------------------------------------------------
RESULTS_DDL = "step string, metric string, value double, detail string, run_id string, recorded_at timestamp"


def write_results(spark, table: str, step: str, rows: list[tuple[str, float, str]], run_id: str) -> None:
    """Replace this step's rows in the results table, so a rerun does not add a second set."""
    from pyspark.sql import functions as F

    spark.sql(f"CREATE TABLE IF NOT EXISTS {table} ({RESULTS_DDL})")
    spark.sql(f"DELETE FROM {table} WHERE step = {sql_string(step)}")
    frame = spark.createDataFrame(
        [(step, metric, float(value), detail, run_id) for metric, value, detail in rows],
        "step string, metric string, value double, detail string, run_id string",
    ).withColumn("recorded_at", F.current_timestamp())
    frame.write.mode("append").saveAsTable(table)
    for metric, value, detail in rows:
        print(f"{step} {metric}: {value:g} {detail}".rstrip())
