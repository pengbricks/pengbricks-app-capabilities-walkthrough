"""Append one row to model_release_history and link the model version back to it."""

import argparse
import sys
from datetime import datetime, timezone

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--model-version", required=True)
p.add_argument("--release", required=True)
p.add_argument("--approved-by", default="")
p.add_argument("--target", required=True)
p.add_argument("--status", required=True)
p.add_argument("--endpoint", default="")
p.add_argument("--served-version", default="")
p.add_argument("--latency-ms", default="0")
p.add_argument("--job-run-id", default="")
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
from databricks.sdk.runtime import spark
from mlflow.tracking import MlflowClient
from pyspark.sql import types as T

import common

SCHEMA = T.StructType(
    [
        T.StructField("model_name", T.StringType()),
        T.StructField("model_version", T.StringType()),
        T.StructField("aliases", T.ArrayType(T.StringType())),
        T.StructField("metrics", T.MapType(T.StringType(), T.DoubleType())),
        T.StructField("release_sha", T.StringType()),
        T.StructField("approved_by", T.StringType()),
        T.StructField("target", T.StringType()),
        T.StructField("status", T.StringType()),
        T.StructField("endpoint", T.StringType()),
        T.StructField("served_version", T.StringType()),
        T.StructField("training_run_url", T.StringType()),
        T.StructField("job_run_id", T.StringType()),
        T.StructField("deployed_at", T.TimestampType()),
    ]
)


def main() -> None:
    spec = common.load_spec(args.spec)
    model_name = common.full_model_name(args.catalog, args.schema, spec)
    history = f"{args.catalog}.{args.schema}.model_release_history"
    mlflow.set_registry_uri("databricks-uc")
    client = MlflowClient(registry_uri="databricks-uc")

    mv = client.get_model_version(model_name, args.model_version)
    metrics = dict(client.get_run(mv.run_id).data.metrics)
    metrics["serving_latency_ms"] = float(args.latency_ms or 0)
    now = datetime.now(timezone.utc)

    row = (
        model_name,
        str(mv.version),
        sorted(mv.aliases),
        {k: float(v) for k, v in metrics.items()},
        args.release,
        args.approved_by or None,
        args.target,
        args.status,
        args.endpoint or None,
        args.served_version or None,
        (mv.tags or {}).get("training_run_url"),
        args.job_run_id,
        now,
    )
    spark.createDataFrame([row], SCHEMA).write.mode("append").option("mergeSchema", "true").saveAsTable(history)

    for key, value in {
        "release_history_table": history,
        "release_status": args.status,
        "release_target": args.target,
        "released_at": now.isoformat(),
        "endpoint": args.endpoint,
    }.items():
        client.set_model_version_tag(model_name, args.model_version, key, value)
    print(f"Recorded {args.status} for version {mv.version} in {history}")


main()
