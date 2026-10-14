"""Check the conformed table: every row has a source_system, counts match the inputs, keys are unique."""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--src-dir", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.src_dir)

    from databricks.sdk.runtime import spark
    from source_ingestion.spec import load_spec

    ms = load_spec(args.use_case_file)["multi_source"]
    ns = f"{args.catalog}.{args.schema}"
    counts = {r["source_system"]: r["n"] for r in spark.sql(f"SELECT source_system, count(*) n FROM {ns}.customers_conformed GROUP BY 1").collect()}
    total = sum(counts.values())
    nulls = spark.sql(f"SELECT count(*) FROM {ns}.customers_conformed WHERE source_system IS NULL").first()[0]
    distinct = spark.sql(f"SELECT count(DISTINCT source_system, source_id) FROM {ns}.customers_conformed").first()[0]
    api_rows = spark.sql(f"SELECT count(*) FROM {ns}.stg_api_users").first()[0]
    print(f"rows by source_system: {counts}; total={total}; null source_system={nulls}; distinct keys={distinct}")
    assert counts.get("database") == ms["db_rows"], counts
    assert counts.get("files") == ms["file_rows"], counts
    assert counts.get("api") == api_rows > 0, counts
    assert nulls == 0 and distinct == total
    print("Conformed table matches all three sources")


if __name__ == "__main__":
    main()
