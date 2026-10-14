"""Guide 4, task 1: train the model that production scoring uses and register it as @prod."""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--experiment", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
import mlflow.sklearn
from databricks.sdk.runtime import dbutils, spark
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    table = c.fq(args.catalog, args.schema, "drift_training_data")
    model_name = f"{args.catalog}.{args.schema}.{spec['model']['drift_name']}"
    c.build_frame(spark, spec, spec["source"]["rows"], spec["seed"]).write.mode("overwrite") \
        .option("overwriteSchema", "true").saveAsTable(table)
    pdf = spark.table(table).toPandas()
    features = spec["model"]["features"]

    mlflow.set_registry_uri("databricks-uc")
    mlflow.set_experiment(args.experiment)
    with mlflow.start_run(run_name="drift-baseline"):
        pipeline, auc, holdout = c.train_and_score(pdf, spec)
        mlflow.log_metric("holdout_auc", auc)
        info = mlflow.sklearn.log_model(
            pipeline, name="model", signature=infer_signature(holdout[features], pipeline.predict(holdout[features])),
            input_example=holdout[features].head(3), registered_model_name=model_name,
        )
    MlflowClient(registry_uri="databricks-uc").set_registered_model_alias(model_name, "prod", info.registered_model_version)
    dbutils.jobs.taskValues.set(key="model_version", value=str(info.registered_model_version))
    print(f"Registered {model_name} v{info.registered_model_version} as @prod, holdout AUC {auc:.4f}")


main()
