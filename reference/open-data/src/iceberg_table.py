"""Create a managed Iceberg table, write, evolve the schema, and use time travel."""

from __future__ import annotations

import argparse

from open_data.checks import append_rows, check_row
from open_data.spec import build_table, load_spec

COLUMNS = ["guide", "check", "status", "value", "detail", "recorded_at"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    spec = load_spec(args.use_case_file)
    cfg = spec["iceberg"]
    table = f"{args.catalog}.{args.schema}.{cfg['table']}"
    added = cfg["added_column"]
    rows: list[dict] = []

    def record(check: str, status: str, value: str, detail: str) -> None:
        rows.append(check_row("iceberg-support", check, status, detail, value=value))
        print(f"[{status}] {check}: {detail}")

    spark.sql(f"DROP TABLE IF EXISTS {table}")
    seed = build_table(spark, spec, "sharing_orders", rows=int(cfg["seed_rows"]))
    seed.createOrReplaceTempView("iceberg_seed")
    spark.sql(f"CREATE TABLE {table} USING ICEBERG AS SELECT * FROM iceberg_seed")
    provider = spark.sql(f"DESCRIBE EXTENDED {table}").filter("col_name = 'Provider'").first()
    record("create_managed_iceberg", "PASS", str(spark.table(table).count()), f"{table} created with USING ICEBERG; provider {provider['data_type'] if provider else 'iceberg'}; {cfg['seed_rows']} rows")

    # Write: append a second batch with a different seed.
    build_table(spark, spec, "sharing_orders", rows=int(cfg["extra_rows"]), seed_offset=1).writeTo(table).append()
    after_append = spark.table(table).count()
    record("append", "PASS" if after_append == cfg["seed_rows"] + cfg["extra_rows"] else "FAIL", str(after_append), f"Appended {cfg['extra_rows']} rows; table has {after_append}")
    v_before_evolve = max(r["version"] for r in spark.sql(f"DESCRIBE HISTORY {table}").collect())

    # Evolve the schema: add a column, backfill, then write rows that carry it.
    spark.sql(f"ALTER TABLE {table} ADD COLUMN {added['name']} {added['type']}")
    spark.sql(f"UPDATE {table} SET {added['name']} = '{added['default']}' WHERE {added['name']} IS NULL")
    columns_now = [f.name for f in spark.table(table).schema.fields]
    record("schema_evolution", "PASS" if added["name"] in columns_now else "FAIL", added["name"], f"Added column {added['name']} {added['type']}; table now has {len(columns_now)} columns, rows backfilled with '{added['default']}'")

    # Time travel: the version before the ALTER has no new column and the pre-update rows.
    old = spark.sql(f"SELECT * FROM {table} VERSION AS OF {v_before_evolve}")
    old_columns = old.columns
    ok = added["name"] not in old_columns and old.count() == after_append
    record("time_travel", "PASS" if ok else "FAIL", str(v_before_evolve), f"VERSION AS OF {v_before_evolve}: {old.count()} rows, {len(old_columns)} columns (no {added['name']}); current table has {len(columns_now)}")
    history = spark.sql(f"DESCRIBE HISTORY {table}").select("version", "operation").orderBy("version").collect()
    record("history", "INFO", str(len(history)), "Versions: " + ", ".join(f"{h['version']}={h['operation']}" for h in history))

    # External access needs EXTERNAL USE SCHEMA for the identity the external client uses.
    me = spark.sql("SELECT current_user()").first()[0]
    spark.sql(f"GRANT EXTERNAL USE SCHEMA ON SCHEMA {args.catalog}.{args.schema} TO `{me}`")
    record("external_use_schema", "PASS", me, f"Granted EXTERNAL USE SCHEMA on {args.catalog}.{args.schema} to the job identity")

    append_rows(spark, f"{args.catalog}.{args.schema}.iceberg_checks", rows, COLUMNS, replace_where="guide = 'iceberg-support'")
    failed = [r["check"] for r in rows if r["status"] == "FAIL"]
    if failed:
        raise SystemExit(f"Failed checks: {failed}")


if __name__ == "__main__":
    main()
