"""Guide 3, task 3: rerun from the recorded references and assert the metric matches."""

import argparse
import json
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--experiment", required=True)
p.add_argument("--run-id", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
from databricks.sdk.runtime import spark
from mlflow.tracking import MlflowClient
from pyspark.sql import functions as F

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    tolerance = spec["model"]["rerun_tolerance"]
    client = MlflowClient()
    original = client.get_run(args.run_id)
    tags, expected = original.data.tags, original.data.metrics["holdout_auc"]
    table, version = tags["data_table"], int(tags["data_version"])
    quoted = c.fq(*table.split("."))

    env_changes = c.diff_environment(json.loads(tags["environment"]), c.environment_versions())
    code_matches = tags["code_hash"] == c.code_hash()
    latest = c.delta_version(spark, quoted)

    # Read the recorded version, not the latest one.
    pdf = spark.sql(f"SELECT * FROM {quoted} VERSION AS OF {version}").toPandas()
    latest_pdf = spark.sql(f"SELECT * FROM {quoted}").toPandas()

    mlflow.set_experiment(args.experiment)
    with mlflow.start_run(run_name="rerun") as run:
        _, auc, _ = c.train_and_score(pdf, spec)
        _, latest_auc, _ = c.train_and_score(latest_pdf, spec)
        diff = abs(auc - expected)
        ok = c.within_tolerance(expected, auc, tolerance) and code_matches
        mlflow.log_metrics({"holdout_auc": auc, "auc_difference": diff})
        mlflow.set_tags({
            "reproduces_run_id": args.run_id, "data_table": table, "data_version": str(version),
            "git_sha": tags["git_sha"], "code_hash": tags["code_hash"], "reproduced": str(ok).lower(),
        })
        rerun_id = run.info.run_id

    row = [(args.run_id, rerun_id, table, version, latest, tags["git_sha"], code_matches, len(env_changes), expected, auc,
            diff, tolerance, ok, latest_auc)]
    schema = ("original_run_id string, rerun_id string, data_table string, data_version long, latest_data_version long, "
              "git_sha string, code_matches boolean, environment_changes int, original_auc double, rerun_auc double, "
              "auc_difference double, tolerance double, reproduced boolean, latest_data_auc double")
    spark.createDataFrame(row, schema).withColumn("checked_at", F.current_timestamp()) \
        .write.mode("append").saveAsTable(c.fq(args.catalog, args.schema, "experiment_reproductions"))
    print(f"Original {expected:.6f}, rerun {auc:.6f} (diff {diff:.2e}, tolerance {tolerance}); data version {version} "
          f"of {latest}; code match {code_matches}; env changes {env_changes or 'none'}; "
          f"latest-data AUC {latest_auc:.6f}")
    if not ok:
        raise RuntimeError("Rerun did not reproduce the tracked run")


main()
