"""Public datasets for the ML guides: download, verify, parse, and the churn snapshot query.

    import public_data as pd_
    path = pd_.fetch("online_retail_ii", "/Volumes/<catalog>/<schema>/<volume>")
    frame = pd_.read_online_retail(path)              # pandas, one row per invoice line
    sql = pd_.customer_snapshot_sql("<table>", "2010-09-01", 6)

Each source is a pinned UCI zip with a SHA-256, so every workspace trains on the same bytes.
Both datasets are CC BY 4.0; keep the citation with anything built from them.

This file is copied into each ML bundle's src/. reference/_shared is the source of truth, and
test_public_data.py checks that the copies match.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import re
import shutil
import urllib.request
import zipfile
from pathlib import Path

SOURCES = {
    "online_retail_ii": {
        "url": "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip",
        "sha256": "572e36277c2390fbfde10664750731e0a86f55e33470d91919085f0408e67bfb",
        "member": "online_retail_II.xlsx",
        "license": "CC BY 4.0",
        "citation": "Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. "
        "https://doi.org/10.24432/C5CG6D",
        # Last invoice in the file; a label window must end before it.
        "last_date": "2011-12-09",
    },
    "credit_card_default": {
        "url": "https://archive.ics.uci.edu/static/public/350/default+of+credit+card+clients.zip",
        "sha256": "56c885f84457f6680f8438f02bfcdac9579323d8a94465ee5f26e32baa727602",
        "member": "default of credit card clients.xls",
        "license": "CC BY 4.0",
        "citation": "Yeh, I. (2009). Default of Credit Card Clients [Dataset]. UCI Machine Learning Repository. "
        "https://doi.org/10.24432/C55S3H",
    },
}

RETAIL_COLUMNS = {
    "Invoice": "invoice",
    "StockCode": "stock_code",
    "Description": "description",
    "Quantity": "quantity",
    "InvoiceDate": "invoice_date",
    "Price": "price",
    "Customer ID": "customer_id",
    "Country": "country",
}

# Days per month used to turn day counts into tenure months.
DAYS_PER_MONTH = 30.44
_TABLE = re.compile(r"^`?[A-Za-z0-9_]+`?(\.`?[A-Za-z0-9_]+`?){0,2}$")


def sha256_of(path: str | Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch(name: str, directory: str | Path) -> Path:
    """Download a source zip into `directory` once, verify it, and return the extracted file.

    A second call finds the verified zip and downloads nothing. A zip with the wrong hash is
    deleted and fetched again, so a partial download never sticks.
    """
    source = SOURCES[name]
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    archive = directory / f"{name}.zip"
    if not archive.exists() or sha256_of(archive) != source["sha256"]:
        partial = directory / f"{name}.zip.partial"
        with urllib.request.urlopen(source["url"], timeout=300) as response, open(partial, "wb") as handle:
            shutil.copyfileobj(response, handle)
        actual = sha256_of(partial)
        if actual != source["sha256"]:
            partial.unlink()
            raise RuntimeError(f"{name}: downloaded SHA-256 {actual} does not match the pinned {source['sha256']}")
        partial.replace(archive)
    target = directory / source["member"]
    if not target.exists():
        with zipfile.ZipFile(archive) as bundle:
            bundle.extract(source["member"], directory)
    return target


def read_online_retail(path: str | Path):
    """Both yearly sheets as one pandas frame with snake_case columns. Needs openpyxl."""
    import pandas as pd

    text = {"Invoice": str, "StockCode": str, "Description": str, "Country": str}
    sheets = pd.read_excel(path, sheet_name=None, dtype=text)
    frame = pd.concat(sheets.values(), ignore_index=True).rename(columns=RETAIL_COLUMNS)
    # Customer IDs arrive as floats because some are blank; keep blanks as nulls.
    frame["customer_id"] = frame["customer_id"].astype("Int64")
    return frame[list(RETAIL_COLUMNS.values())]


def read_credit_default(path: str | Path, columns: dict[str, str]):
    """The credit default sheet with `columns` renamed ({source name: new name}). Needs xlrd."""
    import pandas as pd

    frame = pd.read_excel(path, header=1)  # row 0 holds X1..X23 codes, row 1 the names
    missing = [c for c in columns if c not in frame.columns]
    if missing:
        raise ValueError(f"Columns not in the credit default file: {missing}")
    return frame[list(columns)].rename(columns=columns)


def check_snapshot_date(cut: str, window_months: int, last_date: str) -> None:
    """Fail when the label window of a snapshot runs past the end of the data."""
    start = _dt.date.fromisoformat(cut)
    months = start.month - 1 + window_months
    end = start.replace(year=start.year + months // 12, month=months % 12 + 1)
    if end > _dt.date.fromisoformat(last_date):
        raise ValueError(f"Snapshot {cut} needs data until {end}, but the data ends {last_date}")


def customer_snapshot_sql(transactions: str, cut: str, window_months: int) -> str:
    """One row per customer who bought before `cut`, with features as of `cut` and the churn label.

    Features use only invoices before `cut`. `churned` is 1 when the customer places no order in
    the `window_months` after `cut`. Credit notes (invoice starting with C) count as returns.
    `days_between_orders` is null for customers with a single order. Every feature is DOUBLE: a
    decimal literal would make Spark return DECIMAL, which MLflow cannot serialize in an input example.
    """
    _dt.date.fromisoformat(cut)
    if not _TABLE.match(transactions):
        raise ValueError(f"Not a table name: {transactions}")
    window = int(window_months)
    cut_date = f"DATE'{cut}'"
    return f"""
WITH known AS (
  SELECT * FROM {transactions} WHERE customer_id IS NOT NULL
),
past AS (
  SELECT * FROM known WHERE invoice_date < {cut_date}
),
orders AS (
  SELECT customer_id, min(invoice_date) AS first_order, max(invoice_date) AS last_order,
         count(DISTINCT invoice) AS order_count, sum(quantity * price) AS revenue,
         count(DISTINCT stock_code) AS product_count
  FROM past
  WHERE invoice NOT LIKE 'C%' AND quantity > 0 AND price > 0
  GROUP BY customer_id
),
credit_notes AS (
  SELECT customer_id, count(DISTINCT invoice) AS return_count
  FROM past WHERE invoice LIKE 'C%' GROUP BY customer_id
),
came_back AS (
  SELECT DISTINCT customer_id FROM known
  WHERE invoice_date >= {cut_date} AND invoice_date < add_months({cut_date}, {window})
    AND invoice NOT LIKE 'C%'
)
SELECT
  CAST(o.customer_id AS BIGINT) AS customer_id,
  {cut_date} AS snapshot_date,
  CAST(datediff({cut_date}, o.first_order) / {DAYS_PER_MONTH}D AS DOUBLE) AS tenure_months,
  CAST(o.revenue / greatest(datediff({cut_date}, o.first_order) / {DAYS_PER_MONTH}D, 1.0D) AS DOUBLE) AS monthly_spend,
  CAST(coalesce(r.return_count, 0) AS DOUBLE) AS returns,
  CAST(o.product_count / o.order_count AS DOUBLE) AS products_per_order,
  CAST(datediff({cut_date}, o.last_order) AS DOUBLE) AS days_since_purchase,
  CAST(CASE WHEN o.order_count > 1
            THEN datediff(o.last_order, o.first_order) / (o.order_count - 1) END AS DOUBLE) AS days_between_orders,
  CAST(b.customer_id IS NULL AS INT) AS churned
FROM orders o
LEFT JOIN credit_notes r ON r.customer_id = o.customer_id
LEFT JOIN came_back b ON b.customer_id = o.customer_id
"""
