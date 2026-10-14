"""Generate the training data, train a scikit-learn model, and register it in Unity Catalog."""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--release", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--experiment", required=True)
p.add_argument("--job-run-id", default="")
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
import mlflow.sklearn
from databricks.sdk.runtime import dbutils, spark
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

import common


def main() -> None:
    spec = common.load_spec(args.spec)
    model_name = common.full_model_name(args.catalog, args.schema, spec)
    table = common.training_table(args.catalog, args.schema, spec)
    features, label = spec["features"], spec["label"]["name"]

    # Generate and persist the training data so the tests read the identical rows.
    df = common.build_training_frame(spark, spec)
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    pdf = spark.table(table).toPandas()
    train, holdout = common.split_frame(pdf, spec)

    mlflow.set_registry_uri("databricks-uc")
    mlflow.set_experiment(args.experiment)
    pipeline = Pipeline(
        [("scale", StandardScaler()), ("model", GradientBoostingClassifier(random_state=spec["seed"] % 2**31))]
    )

    with mlflow.start_run(run_name=f"train-{args.release[:7]}") as run:
        pipeline.fit(train[features], train[label])
        auc = roc_auc_score(holdout[label], pipeline.predict_proba(holdout[features])[:, 1])
        mlflow.log_params({"seed": spec["seed"], "rows": len(pdf), "features": ",".join(features)})
        mlflow.log_metrics({"holdout_auc": auc, "positive_rate": float(pdf[label].mean())})
        mlflow.set_tags({"release": args.release, "git_sha": args.release, "training_table": table})
        info = mlflow.sklearn.log_model(
            pipeline,
            name="model",
            signature=infer_signature(train[features], pipeline.predict(train[features])),
            input_example=train[features].head(3),
            registered_model_name=model_name,
        )
        run_id = run.info.run_id
        experiment_id = run.info.experiment_id

    version = str(info.registered_model_version)
    host = spark.conf.get("spark.databricks.workspaceUrl", "")
    client = MlflowClient(registry_uri="databricks-uc")
    for key, value in {
        "release": args.release,
        "git_sha": args.release,
        "training_run_id": run_id,
        "training_run_url": common.run_url(f"https://{host}", experiment_id, run_id) if host else "",
        "job_run_id": args.job_run_id,
        "holdout_auc": f"{auc:.4f}",
    }.items():
        client.set_model_version_tag(model_name, version, key, value)

    dbutils.jobs.taskValues.set(key="model_version", value=version)
    dbutils.jobs.taskValues.set(key="holdout_auc", value=round(auc, 4))
    print(f"Registered {model_name} version {version}, holdout AUC {auc:.4f}")


main()
