# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Train and register a native model
# MAGIC
# MAGIC Trains the pipeline on the training table with MLflow tracking and registers it in Unity Catalog as `churn_classifier`. Each run adds a model version and moves the `trained` alias to it. Run `01_export_legacy_model` first, which writes the training table. Safe to rerun: the experiment is reused and `trained` is set, not added; each run registers a new model version (versions are history).

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_training", ['catalog', 'schema', 'use_case', 'release', 'experiment'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
import mlflow
import mlflow.sklearn
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient

# COMMAND ----------

table = c.fq(catalog, schema, "model_training_data")
model_name = f"{catalog}.{schema}.{spec['model']['trained_name']}"
pdf = spark.table(table).toPandas()
features = spec["model"]["features"]

mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment(params["experiment"])
with mlflow.start_run(run_name="train-native"):
    pipeline, auc, holdout = c.train_and_score(pdf, spec)
    env = c.environment_versions()
    mlflow.log_params({"seed": spec["seed"], "rows": len(pdf), "features": ",".join(features)})
    mlflow.log_metric("holdout_auc", auc)
    mlflow.set_tags({"release": params["release"], "training_table": table.replace("`", ""),
                     **{f"env_{k}": v for k, v in env.items()}})
    info = mlflow.sklearn.log_model(
        pipeline, name="model",
        signature=infer_signature(holdout[features], pipeline.predict(holdout[features])),
        input_example=holdout[features].head(3), registered_model_name=model_name,
    )
client = MlflowClient(registry_uri="databricks-uc")
client.set_registered_model_alias(model_name, "trained", info.registered_model_version)
print(f"Registered {model_name} v{info.registered_model_version}, holdout AUC {auc:.6f}")
