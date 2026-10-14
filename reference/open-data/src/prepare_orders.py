"""Create the sample orders and products tables from the use-case spec."""

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
    write_tables(spark, spec, f"{args.catalog}.{args.schema}", ["orders", "products"])


if __name__ == "__main__":
    main()
