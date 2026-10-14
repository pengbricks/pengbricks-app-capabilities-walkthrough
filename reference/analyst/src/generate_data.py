"""Generate the governed sample tables from the use-case spec (idempotent: overwrites)."""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--src", required=True, help="Path to this bundle's src folder")
    parser.add_argument("--spec", required=True)
    parser.add_argument("--tables", default="customers,products,orders")
    args = parser.parse_args()
    sys.path.insert(0, args.src)

    from databricks.sdk.runtime import spark
    from analyst_common.datagen import build_table
    from analyst_common.spec import load_spec

    spec = load_spec(args.spec)
    for name in [t.strip() for t in args.tables.split(",") if t.strip()]:
        table = spec["tables"][name]
        df = build_table(spark, spec, name, int(table["rows"]), table["columns"])
        target = f"{args.catalog}.{args.schema}.{name}"
        df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
        print(f"Wrote {spark.table(target).count()} rows to {target}")


if __name__ == "__main__":
    main()
