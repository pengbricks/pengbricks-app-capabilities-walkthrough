"""Guide 3, task 1: log a run with its data version, code reference, and environment."""

import argparse
import json
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--release", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--experiment", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
from databricks.sdk.runtime import dbutils, spark

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    table = c.fq(args.catalog, args.schema, "experiment_data")
    c.build_frame(spark, spec, spec["source"]["rows"], spec["seed"]).write.mode("overwrite") \
        .option("overwriteSchema", "true").saveAsTable(table)
    version = c.delta_version(spark, table)
    pdf = spark.sql(f"SELECT * FROM {table} VERSION AS OF {version}").toPandas()

    mlflow.set_experiment(args.experiment)
    with mlflow.start_run(run_name="tracked-run") as run:
        _, auc, _ = c.train_and_score(pdf, spec)
        mlflow.log_params({"seed": spec["seed"], "rows": len(pdf), "features": ",".join(spec["model"]["features"])})
        mlflow.log_metric("holdout_auc", auc)
        mlflow.set_tags({
            "data_table": table.replace("`", ""), "data_version": str(version),
            "git_sha": args.release, "code_hash": c.code_hash(),
            "environment": json.dumps(c.environment_versions()),
        })
        run_id = run.info.run_id
    dbutils.jobs.taskValues.set(key="run_id", value=run_id)
    print(f"Tracked run {run_id}: data version {version}, release {args.release}, AUC {auc:.6f}")


main()
