# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Train the baseline model
# MAGIC
# MAGIC Writes the training data, trains the baseline model, and registers it in Unity Catalog with the `prod` alias. The table is overwritten. Each run adds a model version and moves `prod` to it. Safe to rerun: the experiment is reused, each run registers a new model version (versions are history) and `prod` is set, not added.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_drift", ['catalog', 'schema', 'use_case', 'experiment', 'source_volume'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
import mlflow
import mlflow.sklearn
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient

# COMMAND ----------

table = c.fq(catalog, schema, "drift_training_data")
model_name = f"{catalog}.{schema}.{spec['model']['drift_name']}"
transactions = c.fq(catalog, schema, spec["source"]["transactions_table"])
c.ensure_transactions(spark, spec, transactions, f"/Volumes/{catalog}/{schema}/{params['source_volume']}")
c.snapshot_frame(spark, spec, transactions).write.mode("overwrite") \
    .option("overwriteSchema", "true").saveAsTable(table)
pdf = spark.table(table).toPandas()
features = spec["model"]["features"]

mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment(params["experiment"])
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
