"""Guide 2, task 2: train a scikit-learn model with MLflow and register it in Unity Catalog."""

import argparse
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
import mlflow.sklearn
from databricks.sdk.runtime import spark
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    table = c.fq(args.catalog, args.schema, "model_training_data")
    model_name = f"{args.catalog}.{args.schema}.{spec['model']['trained_name']}"
    pdf = spark.table(table).toPandas()
    features = spec["model"]["features"]

    mlflow.set_registry_uri("databricks-uc")
    mlflow.set_experiment(args.experiment)
    with mlflow.start_run(run_name="train-native"):
        pipeline, auc, holdout = c.train_and_score(pdf, spec)
        env = c.environment_versions()
        mlflow.log_params({"seed": spec["seed"], "rows": len(pdf), "features": ",".join(features)})
        mlflow.log_metric("holdout_auc", auc)
        mlflow.set_tags({"release": args.release, "training_table": table.replace("`", ""),
                         **{f"env_{k}": v for k, v in env.items()}})
        info = mlflow.sklearn.log_model(
            pipeline, name="model",
            signature=infer_signature(holdout[features], pipeline.predict(holdout[features])),
            input_example=holdout[features].head(3), registered_model_name=model_name,
        )
    client = MlflowClient(registry_uri="databricks-uc")
    client.set_registered_model_alias(model_name, "trained", info.registered_model_version)
    print(f"Registered {model_name} v{info.registered_model_version}, holdout AUC {auc:.6f}")


main()
