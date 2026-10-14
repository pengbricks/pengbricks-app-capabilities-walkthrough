"""Pivot the before and after answers into one row per question and print the match counts."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    base = f"{args.catalog}.{args.schema}"
    run_id = args.run_id.replace("'", "")
    spark.sql(
        f"""
        CREATE OR REPLACE TABLE {base}.ontology_comparison_summary AS
        SELECT b.run_id, b.question_id, b.question,
               b.genie_sql AS baseline_sql, b.matches_expected AS baseline_match,
               e.genie_sql AS enhanced_sql, e.matches_expected AS enhanced_match,
               b.expected_sql
        FROM {base}.ontology_comparison b
        JOIN {base}.ontology_comparison e
          ON b.run_id = e.run_id AND b.question_id = e.question_id AND e.stage = 'enhanced'
        WHERE b.stage = 'baseline' AND b.run_id = '{run_id}'
        ORDER BY b.question_id
        """
    )
    summary = spark.table(f"{base}.ontology_comparison_summary")
    total = summary.count()
    before = summary.filter("baseline_match").count()
    after = summary.filter("enhanced_match").count()
    print(f"Matches expected answer: baseline {before}/{total}, with semantics {after}/{total}")
    for row in summary.select("question_id", "baseline_match", "enhanced_match").collect():
        print(f"  {row.question_id}: before={row.baseline_match} after={row.enhanced_match}")
    if total == 0:
        raise RuntimeError("No comparison rows for this run")


if __name__ == "__main__":
    main()
