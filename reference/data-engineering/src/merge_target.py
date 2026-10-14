"""MERGE inserts, updates, and deletes into the target and record the operation metrics."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from de_common.accounts import entity_columns
from de_common.files import merge_metrics
from de_common.spec import load_use_case


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark
    from delta.tables import DeltaTable

    spec = load_use_case(args.use_case_file)
    key = spec["accounts"]["key"]
    columns = entity_columns(spec)
    scope = f"{args.catalog}.{args.schema}"
    target_name, source_name = f"{scope}.accounts_target", f"{scope}.accounts_source_batch"

    before = spark.table(target_name).count()
    source = spark.table(source_name)
    target = DeltaTable.forName(spark, target_name)
    assignments = {name: f"s.{name}" for name in columns}
    (
        target.alias("t")
        .merge(source.alias("s"), f"t.{key} = s.{key}")
        .whenMatchedDelete(condition="s.change_type = 'DELETE'")
        .whenMatchedUpdate(condition="s.change_type = 'UPDATE'", set=assignments)
        .whenNotMatchedInsert(condition="s.change_type = 'INSERT'", values=assignments)
        .execute()
    )
    after = spark.table(target_name).count()

    history = target.history(1).select("version", "operation", "operationMetrics").first()
    metrics = merge_metrics(dict(history["operationMetrics"]))
    changes = spec["accounts"]["changes"]
    print(f"MERGE version {history['version']}: rows {before} -> {after}; metrics {metrics}")

    run_ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = [(run_ts, int(history["version"]), history["operation"], "rows_before", before), (run_ts, int(history["version"]), history["operation"], "rows_after", after)]
    rows += [(run_ts, int(history["version"]), history["operation"], name, value) for name, value in metrics.items()]
    spark.createDataFrame(
        rows, "run_ts string, table_version long, operation string, metric string, value long"
    ).write.mode("append").saveAsTable(f"{scope}.target_merge_metrics")

    expected = {"inserted": changes["inserts"], "updated": changes["updates"], "deleted": changes["deletes"]}
    problems = [f"{k}={metrics[k]} expected {v}" for k, v in expected.items() if metrics[k] != v]
    if after != before + changes["inserts"] - changes["deletes"]:
        problems.append(f"rows_after={after}")
    if problems:
        raise SystemExit("MERGE metrics do not match the change batch: " + "; ".join(problems))


if __name__ == "__main__":
    main()
