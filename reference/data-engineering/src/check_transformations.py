"""Count rows in every pattern view and compare each count with an independent query on the sources."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

# view -> (pattern, SQL that computes the expected row count from the source tables or its upstream view)
CHECKS = [
    ("tp_lookup_enrichment", "lookup enrichment", "SELECT count(*) FROM {s}.customers"),
    ("tp_join_inner", "inner join",
     "SELECT count(*) FROM {s}.orders o JOIN {s}.customers c ON o.customer_id = c.customer_id"),
    ("tp_join_left", "left join", "SELECT count(*) FROM {s}.orders"),
    ("tp_join_full", "full join",
     "SELECT (SELECT count(*) FROM {s}.orders) + (SELECT count(*) FROM {s}.customers c "
     "WHERE NOT EXISTS (SELECT 1 FROM {s}.orders o WHERE o.customer_id = c.customer_id))"),
    ("tp_string_functions", "string functions", "SELECT count(*) FROM {s}.customers"),
    ("tp_null_conditional", "null detection and conditional logic", "SELECT count(*) FROM {s}.customers"),
    ("tp_date_time", "date and time handling", "SELECT count(*) FROM {s}.orders"),
    ("tp_cast_valid", "casting, valid rows",
     "SELECT count(*) FROM {s}.orders WHERE try_cast(amount_raw AS DECIMAL(12,2)) IS NOT NULL "
     "AND try_cast(quantity_raw AS INT) IS NOT NULL"),
    ("tp_cast_rejects", "casting, reject table",
     "SELECT count(*) FROM {s}.orders WHERE try_cast(amount_raw AS DECIMAL(12,2)) IS NULL "
     "OR try_cast(quantity_raw AS INT) IS NULL"),
    ("tp_running_totals", "aggregation with running totals",
     "SELECT count(*) FROM (SELECT DISTINCT category, order_date FROM {s}.tp_cast_valid)"),
    ("tp_pivot", "pivot", "SELECT count(DISTINCT category) FROM {s}.tp_cast_valid"),
    ("tp_unpivot", "unpivot", "SELECT 3 * count(DISTINCT category) FROM {s}.tp_cast_valid"),
    ("tp_last_record", "last record per group", "SELECT count(DISTINCT customer_id) FROM {s}.tp_cast_valid"),
    ("tp_group_iteration", "per-group iteration", "SELECT count(DISTINCT customer_id) FROM {s}.tp_cast_valid"),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    scope = f"{args.catalog}.{args.schema}"
    run_ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows, failures = [], []
    for view, pattern, expected_sql in CHECKS:
        actual = spark.sql(f"SELECT count(*) FROM {scope}.{view}").first()[0]
        expected = spark.sql(expected_sql.format(s=scope)).first()[0]
        passed = actual == expected and actual > 0
        rows.append((run_ts, view, pattern, int(actual), int(expected), passed))
        print(f"{'ok  ' if passed else 'FAIL'} {view:<22} rows={actual:<7} expected={expected}")
        if not passed:
            failures.append(view)

    # One more check: valid + rejected rows account for every order.
    total = spark.sql(f"SELECT count(*) FROM {scope}.orders").first()[0]
    valid = next(r[3] for r in rows if r[1] == "tp_cast_valid")
    rejected = next(r[3] for r in rows if r[1] == "tp_cast_rejects")
    print(f"casting split: {valid} valid + {rejected} rejected = {valid + rejected} of {total} orders")
    if valid + rejected != total:
        failures.append("cast_split")

    spark.createDataFrame(
        rows, "run_ts string, view_name string, pattern string, row_count long, expected_count long, passed boolean"
    ).write.mode("append").saveAsTable(f"{scope}.tp_view_counts")
    if failures:
        raise SystemExit(f"Row count checks failed: {failures}")


if __name__ == "__main__":
    main()
