"""Record current rows, history rows, and deleted keys for the SCD type 1 and type 2 tables."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from de_common.spec import load_use_case


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--phase", choices=["before", "after"], required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    scope = f"{args.catalog}.{args.schema}"
    # SCD type 1 has no end date, so every row is current.
    targets = {"scd1": ("accounts_scd1", "TRUE"), "scd2": ("accounts_scd2", "__END_AT IS NULL")}
    values: dict[str, dict[str, int]] = {}
    for label, (table, current) in targets.items():
        full = f"{scope}.{table}"
        values[label] = {
            "current_rows": spark.sql(f"SELECT count(*) FROM {full} WHERE {current}").first()[0],
            "history_rows": spark.table(full).count(),
            "keys_with_multiple_rows": spark.sql(
                f"SELECT count(*) FROM (SELECT account_id FROM {full} GROUP BY account_id HAVING count(*) > 1)"
            ).first()[0],
            # A deleted key is one the feed deleted that has no current row in the target.
            "deleted_keys": spark.sql(
                f"SELECT count(*) FROM (SELECT DISTINCT account_id FROM {scope}.accounts_changes "
                f"WHERE change_type = 'DELETE') d WHERE NOT EXISTS "
                f"(SELECT 1 FROM {full} t WHERE t.account_id = d.account_id AND {current})"
            ).first()[0],
        }

    run_ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = [(run_ts, args.phase, metric, int(values["scd1"][metric]), int(values["scd2"][metric])) for metric in values["scd1"]]
    for row in rows:
        print(f"{row[1]:<7} {row[2]:<24} scd1={row[3]:<6} scd2={row[4]}")
    spark.createDataFrame(
        rows, "run_ts string, phase string, metric string, scd1 long, scd2 long"
    ).write.mode("append").saveAsTable(f"{scope}.scd_run_counts")

    spec = load_use_case(args.use_case_file)
    accounts = spec["accounts"]
    changes = accounts["changes"]
    expected = (
        {"current_rows": accounts["rows"], "deleted_keys": 0}
        if args.phase == "before"
        else {
            "current_rows": accounts["rows"] + changes["inserts"] - changes["deletes"],
            "deleted_keys": changes["deletes"],
        }
    )
    expected_history = (
        accounts["rows"]
        if args.phase == "before"
        else accounts["rows"] + changes["inserts"] + changes["updates"]
    )
    problems = []
    for label in ("scd1", "scd2"):
        for metric, want in expected.items():
            if values[label][metric] != want:
                problems.append(f"{label}.{metric}={values[label][metric]}, expected {want}")
    if values["scd2"]["history_rows"] != expected_history:
        problems.append(f"scd2.history_rows={values['scd2']['history_rows']}, expected {expected_history}")
    if problems:
        raise SystemExit("SCD counts do not match the spec: " + "; ".join(problems))


if __name__ == "__main__":
    main()
