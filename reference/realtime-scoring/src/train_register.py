"""Generate training data from the use-case spec, train a small model, and register it in Unity Catalog.

Data comes from dbldatagen with the spec's fixed seed, so reruns train on identical rows.
The model is a scikit-learn pipeline: a first step adds any omitted optional feature as NaN and
the imputer fills it with the training median. The MLflow signature marks that feature as optional so the endpoint accepts
requests that omit it.
"""

from __future__ import annotations

import argparse

import yaml


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    import dbldatagen as dg
    import mlflow
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import dbutils, spark
    from mlflow.models import ModelSignature
    from mlflow.types import ColSpec, Schema
    from pyspark.sql import functions as F
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import FunctionTransformer

    with open(args.use_case_file) as handle:
        spec = yaml.safe_load(handle)
    model_spec = spec["model"]
    features = model_spec["features"]
    names = [f["name"] for f in features]
    label = model_spec["label"]
    rows = int(model_spec["training"]["rows"])

    generator = dg.DataGenerator(spark, name="training", rows=rows, partitions=2, randomSeedMethod="hash_fieldname", seed=int(spec["seed"])).withIdOutput()
    for feature in features:
        generator = generator.withColumn(
            feature["name"], "double", minValue=feature["min"], maxValue=feature["max"], random=True
        )
    frame = generator.build().withColumn(label, F.expr(model_spec["training"]["label_expr"]))

    table = f"{args.catalog}.{args.schema}.scoring_training_data"
    frame.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    print(f"Wrote {rows} training rows to {table}")

    data = spark.table(table).select(*names, label).toPandas()
    x_train, x_test, y_train, y_test = train_test_split(
        data[names], data[label], test_size=0.2, random_state=int(spec["seed"]) % 1000
    )
    def align_columns(frame, columns=tuple(names)):
        # Adds any omitted optional feature as NaN so the imputer can fill it.
        return frame.reindex(columns=list(columns))

    model = Pipeline(
        [
            ("align", FunctionTransformer(align_columns, validate=False)),
            ("impute", SimpleImputer(strategy="median")),
            ("model", GradientBoostingClassifier(n_estimators=60, max_depth=3, random_state=7)),
        ]
    )
    model.fit(x_train, y_train)
    auc = float(roc_auc_score(y_test, model.predict_proba(x_test)[:, 1]))
    print(f"Holdout AUC {auc:.3f}")

    signature = ModelSignature(
        inputs=Schema([ColSpec("double", f["name"], required=not f.get("optional", False)) for f in features]),
        outputs=Schema([ColSpec("long")]),
    )

    mlflow.set_registry_uri("databricks-uc")
    user = WorkspaceClient().current_user.me().user_name
    mlflow.set_experiment(f"/Users/{user}/capability-guides-realtime-scoring")
    full_name = f"{args.catalog}.{args.schema}.{model_spec['name']}"
    with mlflow.start_run(run_name="train_register"):
        mlflow.log_metric("holdout_auc", auc)
        info = mlflow.sklearn.log_model(
            model,
            name="model",
            signature=signature,
            input_example=x_train.head(2),
            registered_model_name=full_name,
        )
    version = str(info.registered_model_version)

    from mlflow import MlflowClient

    MlflowClient(registry_uri="databricks-uc").set_registered_model_alias(full_name, model_spec["alias"], version)
    print(f"Registered {full_name} version {version} with alias {model_spec['alias']}")
    dbutils.jobs.taskValues.set(key="model_name", value=full_name)
    dbutils.jobs.taskValues.set(key="model_version", value=version)


if __name__ == "__main__":
    main()
