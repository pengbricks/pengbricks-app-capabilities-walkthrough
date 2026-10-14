"""Create the table at contract v1.0.0, then evolve it in place to v1.1.0 (nonbreaking)."""

from __future__ import annotations

from versioning_common import (
    contracts_for, delta_version, drop_any, ensure_registry, fq, load_spec, parse_args, register, set_tags,
)


def main() -> None:
    args = parse_args(extra=["release"])
    from databricks.sdk.runtime import spark
    from compatibility import create_table_sql, diff_contracts, evolve_sql

    spec = load_spec(args.use_case_file)
    dataset = spec["dataset"]["name"]
    contracts = contracts_for(args, spec)
    v1, v11 = contracts["1.0.0"], contracts["1.1.0"]

    seed = fq(args.catalog, args.schema, f"{dataset}_seed")
    table = fq(args.catalog, args.schema, f"{dataset}_v1")

    # Reset objects from earlier runs so the job is rerunnable.
    for name in (f"{dataset}_v1", f"{dataset}_v1_archive", f"{dataset}_v2"):
        drop_any(spark, fq(args.catalog, args.schema, name))
    ensure_registry(spark, args.catalog, args.schema)
    spark.sql(f"DELETE FROM {fq(args.catalog, args.schema, 'contract_registry')} WHERE dataset = '{dataset}'")

    # v1.0.0: create the table from the contract and load the seed rows.
    spark.sql(create_table_sql(v1, table))
    v1_columns = ", ".join(f"`{c['name']}`" for c in v1["columns"])
    spark.sql(f"INSERT INTO {table} SELECT {v1_columns} FROM {seed}")
    register(spark, args.catalog, args.schema, dataset=dataset, version="1.0.0", change_type="initial",
             object_name=f"{dataset}_v1", release=args.release, delta_ver=delta_version(spark, table))
    set_tags(spark, table, {"contract_version": "1.0.0", "deprecated": "false"})
    print(f"v1.0.0 applied: {spark.table(table).count()} rows")

    # v1.1.0: nonbreaking. ALTER TABLE in place; existing rows get NULL until backfilled.
    for change in diff_contracts(v1, v11):
        print(f"  {change.classification}: {change.kind} {change.detail}")
    for statement in evolve_sql(v1, v11, table):
        print("  " + statement)
        spark.sql(statement)
    added = [c.new_column for c in diff_contracts(v1, v11) if c.kind == "add_nullable_column"]
    if added:
        assignments = ", ".join(f"t.`{c}` = s.`{c}`" for c in added)
        spark.sql(f"MERGE INTO {table} t USING {seed} s ON t.customer_id = s.customer_id "
                  f"WHEN MATCHED THEN UPDATE SET {assignments}")
    register(spark, args.catalog, args.schema, dataset=dataset, version="1.1.0", change_type="nonbreaking",
             object_name=f"{dataset}_v1", release=args.release, delta_ver=delta_version(spark, table))
    set_tags(spark, table, {"contract_version": "1.1.0", "deprecated": "false"})
    print("v1.1.0 applied in place; consumers of the table needed no change.")
    spark.sql(f"SELECT * FROM {table} LIMIT 5").show(truncate=False)


if __name__ == "__main__":
    main()
