"""Helpers for the AI Functions guide: spec loading, sample files, scoring, and the results table."""

from __future__ import annotations

import json
import re
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
