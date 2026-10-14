"""Write the sample rows as CSV, pipe-delimited text, Excel, nested JSON, and XML.

Every writer takes plain Python rows (a list of dicts), so the shapes are unit-testable
without Spark.
"""

from __future__ import annotations

import csv
import json
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from xml.etree import ElementTree as ET


def _text(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value, "f")
    return value


def write_delimited(path: str, rows: list[dict[str, Any]], delimiter: str = ",") -> None:
    """Write a header plus rows. Fields that contain the delimiter, a quote, or a newline get quoted."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=list(rows[0]),
            delimiter=delimiter,
            quotechar='"',
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({key: _text(value) for key, value in row.items()})


def write_workbook(path: str, sheets: dict[str, list[dict[str, Any]]]) -> None:
    """Write one sheet per entry: a header row, then data rows."""
    from openpyxl import Workbook

    os.makedirs(os.path.dirname(path), exist_ok=True)
    workbook = Workbook()
    workbook.remove(workbook.active)
    for name, rows in sheets.items():
        sheet = workbook.create_sheet(title=name)
        sheet.append(list(rows[0]))
        for row in rows:
            sheet.append([row[key] if not isinstance(row[key], Decimal) else float(row[key]) for key in rows[0]])
    workbook.save(path)


def nest_customer(row: dict[str, Any], index: int) -> dict[str, Any]:
    """Shape a flat customer into a nested document: a struct, an array of structs, and an optional field."""
    document: dict[str, Any] = {
        "customer_id": row["customer_id"],
        "name": {"first": row["first_name"], "last": row["last_name"]},
        "address": {"city": row["city"], "country": row["country"]},
        "contacts": [{"type": "email", "value": row["email"]}],
        "credit_limit": float(row["credit_limit"]),
        "created_date": _text(row["created_date"]),
    }
    if index % 3 == 0:
        document["contacts"].append({"type": "phone", "value": f"+1-555-{1000 + index:04d}"})
    if index % 5 == 0:
        document["loyalty"] = {"tier": "gold", "points": 100 + index}
    return document


def write_nested_json(path: str, customers: list[dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    documents = [nest_customer(row, index) for index, row in enumerate(customers)]
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(documents, handle, indent=2)


def build_orders_xml(orders: list[dict[str, Any]], max_lines: int, coupon_every: int) -> ET.ElementTree:
    """Orders with a repeating <line> node (1..max_lines) and an optional <coupon> node."""
    root = ET.Element("orders")
    for index, order in enumerate(orders):
        element = ET.SubElement(root, "order", {"id": str(order["order_id"])})
        ET.SubElement(element, "customer_id").text = str(order["customer_id"])
        ET.SubElement(element, "order_date").text = _text(order["order_date"])
        lines = ET.SubElement(element, "lines")
        for line_number in range(1 + index % max_lines):
            ET.SubElement(lines, "line", {"sku": f"SKU-{(index + line_number) % 40:03d}", "qty": str(1 + line_number)})
        if index % coupon_every == 0:
            ET.SubElement(element, "coupon").text = f"SAVE{order['discount_pct'] or 5}"
    return ET.ElementTree(root)


def write_orders_xml(path: str, orders: list[dict[str, Any]], max_lines: int, coupon_every: int) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tree = build_orders_xml(orders, max_lines, coupon_every)
    ET.indent(tree)
    tree.write(path, encoding="utf-8", xml_declaration=True)


def expected_xml_counts(rows: int, max_lines: int, coupon_every: int) -> dict[str, int]:
    """Row counts the XML table must have, derived from the same rules the writer uses."""
    lines = sum(1 + index % max_lines for index in range(rows))
    coupons = len(range(0, rows, coupon_every))
    return {"orders": rows, "lines": lines, "coupons": coupons}


def expected_json_counts(rows: int) -> dict[str, int]:
    contacts = sum(2 if index % 3 == 0 else 1 for index in range(rows))
    loyalty = len(range(0, rows, 5))
    return {"customers": rows, "contacts": contacts, "loyalty": loyalty}


def count_delimited_with_embedded_delimiter(rows: list[dict[str, Any]], delimiter: str) -> int:
    return sum(any(isinstance(v, str) and delimiter in v for v in row.values()) for row in rows)
