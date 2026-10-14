"""Create the governed source tables and the row-limiting view that the share exposes."""

from __future__ import annotations

import argparse

from open_data.spec import load_spec, write_tables


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    spec = load_spec(args.use_case_file)
    sharing = spec["sharing"]
    prefix = f"{args.catalog}.{args.schema}"

    write_tables(spark, spec, prefix, list(spec["tables"]))

    columns = ", ".join(sharing["view_columns"])
    view = f"{prefix}.{sharing['view_name']}"
    spark.sql(
        f"CREATE OR REPLACE VIEW {view} "
        f"COMMENT 'Orders for one region without personal data. This is the only orders object the share exposes.' AS "
        f"SELECT {columns} FROM {prefix}.orders WHERE region = '{sharing['view_region']}'"
    )
    print(f"{view}: {spark.table(view).count()} rows")


if __name__ == "__main__":
    main()
