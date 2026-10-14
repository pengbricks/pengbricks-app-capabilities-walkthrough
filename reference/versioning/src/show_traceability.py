"""Show the contract registry, Delta history, UC tags, and prove v1 consumers still get the v1 shape."""

from __future__ import annotations

from versioning_common import contracts_for, fq, load_spec, parse_args


def main() -> None:
    args = parse_args()
    from databricks.sdk.runtime import spark

    spec = load_spec(args.use_case_file)
    dataset = spec["dataset"]["name"]
    contracts = contracts_for(args, spec)

    print("== contract_registry")
    spark.table(fq(args.catalog, args.schema, "contract_registry")).orderBy("applied_at", "version").show(truncate=False)

    for suffix in ("v1_archive", "v2"):
        table = fq(args.catalog, args.schema, f"{dataset}_{suffix}")
        print(f"== DESCRIBE HISTORY {dataset}_{suffix}")
        spark.sql(f"DESCRIBE HISTORY {table}").select("version", "timestamp", "operation", "operationParameters").show(truncate=60)

    print("== Unity Catalog tags")
    spark.sql(f"""SELECT table_name, tag_name, tag_value
                  FROM `{args.catalog}`.information_schema.table_tags
                  WHERE schema_name = '{args.schema}' AND table_name LIKE '{dataset}%'
                  ORDER BY table_name, tag_name""").show(truncate=False)

    # Compatibility check against the data: the view must expose exactly the v1.1.0 columns and types.
    view = spark.table(fq(args.catalog, args.schema, f"{dataset}_v1"))
    actual = [(f.name, f.dataType.simpleString()) for f in view.schema.fields]
    expected = [(c["name"], c["type"].replace(" ", "")) for c in contracts["1.1.0"]["columns"]]
    assert actual == expected, f"compat view {actual} != contract v1.1.0 {expected}"
    v2_count = spark.table(fq(args.catalog, args.schema, f"{dataset}_v2")).count()
    assert view.count() == v2_count
    print(f"Compatibility verified: {dataset}_v1 exposes the v1.1.0 shape over {v2_count} rows of {dataset}_v2.")


if __name__ == "__main__":
    main()
