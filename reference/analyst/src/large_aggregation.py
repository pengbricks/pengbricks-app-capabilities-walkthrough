"""Generate a multi-million-row table and time aggregations over it on serverless compute."""

from __future__ import annotations

import argparse
import sys
import time


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--src", required=True)
    parser.add_argument("--spec", required=True)
    parser.add_argument("--run-id", default="manual")
    args = parser.parse_args()
    sys.path.insert(0, args.src)

    from databricks.sdk.runtime import spark
    from pyspark.sql import functions as F
    from analyst_common.datagen import build_table
    from analyst_common.spec import load_spec

    spec = load_spec(args.spec)
    large = spec["large_table"]
    fq = f"{args.catalog}.{args.schema}"
    source = f"{fq}.{large['name']}"
    timings: list[tuple[str, int, float]] = []

    def timed(step: str, rows_fn):
        start = time.perf_counter()
        rows = rows_fn()
        seconds = round(time.perf_counter() - start, 2)
        timings.append((step, int(rows), seconds))
        print(f"{step}: {rows} rows in {seconds}s")

    def generate():
        df = build_table(spark, spec, large["name"], int(large["rows"]), large["columns"], partitions=32)
        df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(source)
        return spark.table(source).count()

    timed("generate_and_write_events", generate)

    events = spark.table(source)
    timed("full_scan_count", lambda: events.count())

    def per_customer_month():
        out = (
            events.where(F.col("event_type") == "purchase")
            .groupBy("customer_id", F.date_trunc("month", "event_ts").alias("month"))
            .agg(F.count("*").alias("purchases"), F.sum("amount").alias("revenue"))
        )
        out.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.events_large_customer_month")
        return out.count()

    timed("aggregate_customer_by_month", per_customer_month)

    def percentiles():
        row = (
            events.groupBy("event_type")
            .agg(
                F.count("*").alias("events"),
                F.sum("amount").alias("amount"),
                F.percentile_approx("amount", [0.5, 0.95]).alias("p50_p95"),
            )
            .collect()
        )
        return len(row)

    timed("aggregate_percentiles_by_type", percentiles)

    schema_ddl = "step STRING, rows BIGINT, seconds DOUBLE, run_id STRING, recorded_at TIMESTAMP"
    result = spark.createDataFrame(
        [(step, rows, seconds, args.run_id) for step, rows, seconds in timings],
        "step STRING, rows BIGINT, seconds DOUBLE, run_id STRING",
    ).withColumn("recorded_at", F.current_timestamp())
    spark.sql(f"CREATE TABLE IF NOT EXISTS {fq}.large_aggregation_timing ({schema_ddl})")
    result.write.mode("append").saveAsTable(f"{fq}.large_aggregation_timing")


if __name__ == "__main__":
    main()
