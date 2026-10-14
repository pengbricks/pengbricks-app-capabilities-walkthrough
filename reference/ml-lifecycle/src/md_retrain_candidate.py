"""Guide 4, task 4 (runs only on a breach): train a challenger on recent data. A person promotes it."""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--experiment", required=True)
p.add_argument("--first-breach-batch", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
import mlflow.sklearn
import pandas as pd
from mlflow.models import infer_signature
from databricks.sdk.runtime import spark
from mlflow.tracking import MlflowClient
from pyspark.sql import functions as F
from sklearn.metrics import roc_auc_score

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    features, label, key = spec["model"]["features"], spec["label"]["name"], spec["source"]["key"]
    model_name = f"{args.catalog}.{args.schema}.{spec['model']['drift_name']}"
    first = int(args.first_breach_batch)
    train_base = spark.table(c.fq(args.catalog, args.schema, "drift_training_data")).toPandas()
    scores = spark.table(c.fq(args.catalog, args.schema, "batch_scores")).toPandas()
    recent = scores[scores["batch_id"] >= first]

    # Hold out the last batch to compare the current @prod model with the candidate on the new distribution.
    last = recent["batch_id"].max()
    eval_set = recent[recent["batch_id"] == last]
    fit_set = pd.concat([train_base[[key, *features, label]], recent[recent["batch_id"] != last][[key, *features, label]]])

    mlflow.set_registry_uri("databricks-uc")
    mlflow.set_experiment(args.experiment)
    prod = mlflow.sklearn.load_model(f"models:/{model_name}@prod")
    prod_auc = float(roc_auc_score(eval_set[label], prod.predict_proba(eval_set[features])[:, 1]))
    with mlflow.start_run(run_name="retrain-candidate"):
        candidate = c.make_pipeline(spec["seed"]).fit(fit_set[features], fit_set[label])
        cand_auc = float(roc_auc_score(eval_set[label], candidate.predict_proba(eval_set[features])[:, 1]))
        mlflow.log_metrics({"prod_auc_on_recent": prod_auc, "candidate_auc_on_recent": cand_auc})
        info = mlflow.sklearn.log_model(
            candidate, name="model", registered_model_name=model_name,
            signature=infer_signature(eval_set[features], candidate.predict(eval_set[features])),
            input_example=eval_set[features].head(3),
        )
    MlflowClient(registry_uri="databricks-uc").set_registered_model_alias(model_name, "challenger", info.registered_model_version)

    spark.createDataFrame(
        [(model_name, str(info.registered_model_version), first, int(last), prod_auc, cand_auc, "awaiting review")],
        "model string, challenger_version string, first_breach_batch int, eval_batch int, prod_auc double, "
        "candidate_auc double, status string",
    ).withColumn("created_at", F.current_timestamp()).write.mode("append").saveAsTable(c.fq(args.catalog, args.schema, "retraining_log"))
    print(f"Challenger v{info.registered_model_version}: AUC {cand_auc:.4f} vs @prod {prod_auc:.4f} on batch {last}")


main()
