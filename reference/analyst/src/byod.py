"""Bring your own data: simulate an upload to a per-user volume path, then join it to a governed table.

--step upload   write a CSV to /Volumes/<catalog>/<schema>/uploads/<user>/<file>
--step join     full outer join the upload to customers; keep unmatched keys on both sides
"""

from __future__ import annotations

import argparse
import csv
import os
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--src", required=True)
    parser.add_argument("--spec", required=True)
    parser.add_argument("--step", choices=["upload", "join"], required=True)
    parser.add_argument("--run-id", default="manual")
    args = parser.parse_args()
    sys.path.insert(0, args.src)

    from databricks.sdk.runtime import spark
    from pyspark.sql import functions as F
    from analyst_common.helpers import match_counts, upload_path
    from analyst_common.spec import load_spec

    spec = load_spec(args.spec)["upload"]
    fq = f"{args.catalog}.{args.schema}"
    user = spark.sql("SELECT current_user()").first()[0]
    path = upload_path(args.catalog, args.schema, "uploads", user, spec["file_name"])

    if args.step == "upload":
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # Keys 0..matched-1 exist in customers. Keys from unmatched_start up do not.
        keys = [f"{spec['key_prefix']}{i:06d}" for i in range(int(spec["matched_keys"]))]
        keys += [f"{spec['key_prefix']}{int(spec['unmatched_start']) + i:06d}" for i in range(int(spec["unmatched_keys"]))]
        with open(path, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["customer_id", "account_owner", "annual_target"])
            for index, key in enumerate(keys):
                writer.writerow([key, f"owner_{index % 12:02d}", 10000 + (index * 137) % 90000])
        print(f"Wrote {len(keys)} rows to {path}")
        return

    uploaded = (
        spark.read.option("header", "true").option("inferSchema", "true").csv(path)
        .withColumn("customer_id", F.trim("customer_id"))
        .withColumn("in_upload", F.lit(True))
    )
    governed = spark.table(f"{fq}.customers").select("customer_id", "region", "segment").withColumn("in_governed", F.lit(True))
    joined = (
        uploaded.join(governed, "customer_id", "full_outer")
        .withColumn("in_upload", F.coalesce("in_upload", F.lit(False)))
        .withColumn("in_governed", F.coalesce("in_governed", F.lit(False)))
        .withColumn(
            "match_status",
            F.when(F.col("in_upload") & F.col("in_governed"), "matched")
            .when(F.col("in_upload"), "upload_only")
            .otherwise("governed_only"),
        )
        .withColumn("source_path", F.lit(path))
    )
    joined.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.byod_joined")
    rows = spark.table(f"{fq}.byod_joined").groupBy("match_status").count().collect()
    counts = match_counts([r["match_status"] for r in rows for _ in range(r["count"])])
    print("Match counts:", counts)
    result = spark.createDataFrame(
        [(status, n, path, user, args.run_id) for status, n in counts.items()],
        "match_status STRING, key_count BIGINT, source_path STRING, uploaded_by STRING, run_id STRING",
    ).withColumn("recorded_at", F.current_timestamp())
    result.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.byod_match_counts")
    if counts["matched"] == 0:
        raise RuntimeError("No uploaded key matched the governed table")


if __name__ == "__main__":
    main()
