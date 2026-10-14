"""Guide 2, task 3: bring the pickled model in as a pyfunc, register it, and reproduce its baseline."""

import argparse
import json
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--volume", required=True)
p.add_argument("--release", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--experiment", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
import mlflow.pyfunc
from databricks.sdk.runtime import spark
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient
from pyspark.sql import functions as F
from sklearn.metrics import roc_auc_score

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    base = f"/Volumes/{args.catalog}/{args.schema}/{args.volume}"
    with open(f"{base}/legacy_model.json") as handle:
        recorded = json.load(handle)
    model_name = f"{args.catalog}.{args.schema}.{spec['model']['imported_name']}"
    features, label = spec["model"]["features"], spec["label"]["name"]
    tolerance = spec["model"]["baseline_tolerance"]

    # Same rows the baseline used: the table version the legacy model recorded.
    table = c.fq(args.catalog, args.schema, "model_training_data")
    pdf = spark.sql(f"SELECT * FROM {table} VERSION AS OF {recorded['training_table_version']}").toPandas()
    _, holdout = c.split_frame(pdf, spec["source"]["key"], spec["model"]["holdout_mod"])

    current = c.environment_versions()
    mlflow.set_registry_uri("databricks-uc")
    mlflow.set_experiment(args.experiment)
    with mlflow.start_run(run_name="import-legacy-pickle") as run:
        info = mlflow.pyfunc.log_model(
            name="model",
            python_model=f"{args.src_dir}/legacy_pyfunc.py",
            artifacts={"model_pickle": f"{base}/legacy_model.pkl"},
            signature=infer_signature(holdout[features], [0.5] * len(holdout)),
            input_example=holdout[features].head(3),
            pip_requirements=[f"scikit-learn=={current['scikit-learn']}", f"pandas=={current['pandas']}",
                              f"numpy=={current['numpy']}", f"mlflow=={current['mlflow']}"],
            registered_model_name=model_name,
        )
        loaded = mlflow.pyfunc.load_model(info.model_uri)
        auc = float(roc_auc_score(holdout[label], loaded.predict(holdout[features])))
        diff = abs(auc - recorded["baseline_holdout_auc"])
        mlflow.log_metrics({"baseline_auc": recorded["baseline_holdout_auc"], "reproduced_auc": auc, "auc_difference": diff})
        mlflow.set_tags({"release": args.release, **{f"env_{k}": v for k, v in current.items()},
                         **{f"legacy_env_{k}": v for k, v in recorded["environment"].items()}})
        run_id = run.info.run_id
    client = MlflowClient(registry_uri="databricks-uc")
    client.set_registered_model_alias(model_name, "imported", info.registered_model_version)

    # Change log: what differs between the runtime that produced the pickle and this one.
    changes = c.diff_environment(recorded["environment"], current)
    rows = [(k, recorded["environment"][k], current.get(k, "missing"), recorded["environment"][k] != current.get(k))
            for k in recorded["environment"]]
    rows.append(("holdout_auc", f"{recorded['baseline_holdout_auc']:.6f}", f"{auc:.6f}", diff > tolerance))
    log = spark.createDataFrame(rows, "item string, recorded string, current string, changed boolean") \
        .withColumn("model", F.lit(model_name)).withColumn("model_version", F.lit(str(info.registered_model_version))) \
        .withColumn("mlflow_run_id", F.lit(run_id)).withColumn("checked_at", F.current_timestamp())
    log.write.mode("append").saveAsTable(c.fq(args.catalog, args.schema, "model_compatibility_log"))

    print(f"Imported {model_name} v{info.registered_model_version}; baseline {recorded['baseline_holdout_auc']:.6f} "
          f"reproduced {auc:.6f} (diff {diff:.2e}, tolerance {tolerance}); package changes: {changes or 'none'}")
    if diff > tolerance:
        raise RuntimeError(f"Reproduced AUC differs from baseline by {diff:.6f} (tolerance {tolerance})")


main()
