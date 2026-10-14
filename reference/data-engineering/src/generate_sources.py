"""Create the source tables for the transformation patterns pipeline."""

from __future__ import annotations

import argparse

from de_common.datagen import build_frame
from de_common.spec import load_use_case


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    spec = load_use_case(args.use_case_file)
    prefix = f"{args.catalog}.{args.schema}"

    regions = spec["tables"]["regions"]["static_rows"]
    spark.createDataFrame(regions).write.mode("overwrite").saveAsTable(f"{prefix}.regions")
    print(f"regions: {len(regions)} rows")

    for offset, name in enumerate(("customers", "orders")):
        table = spec["tables"][name]
        df = build_frame(spark, name, int(spec["seed"]) + offset, int(table["rows"]), table["columns"]).drop("id")
        df.write.mode("overwrite").saveAsTable(f"{prefix}.{name}")
        print(f"{name}: {spark.table(f'{prefix}.{name}').count()} rows")


if __name__ == "__main__":
    main()
