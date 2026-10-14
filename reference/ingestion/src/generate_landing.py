"""Land deterministic sample files for every feed in a use case.

--mode batch   overwrite each feed's landing folder (idempotent reruns)
--mode stream  append new event files for the streaming pipeline to pick up
"""

from __future__ import annotations

import argparse
import time

from capability_framework.datagen import bad_row_exprs, canonical, feed_frame
from capability_framework.runner import ensure_tables
from capability_framework.use_case import feed_names, load_use_case


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--mode", choices=["batch", "stream"], default="batch")
    args = parser.parse_args()

    from databricks.sdk.runtime import dbutils, spark

    spec = load_use_case(args.use_case_file)
    landing = f"/Volumes/{args.catalog}/{args.schema}/landing"

    if args.mode == "batch":
        ensure_tables(spark, args.catalog, args.schema)
        for index, feed in enumerate(spec["feeds"]):
            df = feed_frame(spark, spec, feed, seed_offset=index)
            writer = df.coalesce(1).write.mode("overwrite")
            path = f"{landing}/{feed['name']}"
            if feed["format"] == "csv":
                writer.option("header", "true").csv(path)
            else:
                writer.format(feed["format"]).save(path)
            print(f"Landed {feed['rows']} rows for {feed['name']} at {path}")
        dbutils.jobs.taskValues.set(key="feeds", value=feed_names(spec))
        return

    stream = spec["streaming"]
    from pyspark.sql import functions as F

    start = int(time.time())
    for batch in range(int(stream["batches"])):
        rows = int(stream["rows_per_batch"])
        events = canonical(spark, spec, rows, seed_offset=1000 + batch, id_offset=start * 10 + batch * rows)
        for column, expression in bad_row_exprs(spec):
            events = events.withColumn(column, F.expr(expression))
        events = events.select(
            F.col("record_id").alias("event_id"),
            "account_id",
            F.date_format(F.current_timestamp(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").alias("event_ts"),
            F.col("amount").cast("double").alias("amount"),
            "currency",
            "status",
        )
        events.coalesce(1).write.mode("append").json(f"{landing}/{stream['feed']}")
        print(f"Landed streaming batch {batch + 1} with {rows} events")
        time.sleep(5)


if __name__ == "__main__":
    main()
