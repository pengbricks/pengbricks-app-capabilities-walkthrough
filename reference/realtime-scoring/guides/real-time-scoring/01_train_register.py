# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Train and register the model
# MAGIC
# MAGIC Trains on UCI Default of Credit Card Clients (CC BY 4.0): whether a card holder defaults on next month's payment. The file is downloaded once into a volume and checked against a pinned SHA-256, so reruns train on identical data. The table is overwritten, and the registered model gets a new version each run with the `champion` alias moved to it. Safe to rerun: the experiment is reused and `champion` is set, not added; each run registers a new model version (versions are history).

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_realtime_scoring", ['catalog', 'schema', 'use_case', 'source_volume'])
catalog, schema = params["catalog"], params["schema"]

import yaml
with open(bundle_root() / "use_cases" / f"{params['use_case']}.yml") as handle:
    spec = yaml.safe_load(handle)
model_spec = spec["model"]
features = model_spec["features"]
names = [f["name"] for f in features]
label = model_spec["label"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Land and save the training data

# COMMAND ----------

import public_data, scoring_helpers

training = model_spec["training"]
path = scoring_helpers.fetch_public(training["dataset"], f"/Volumes/{catalog}/{schema}/{params['source_volume']}")
columns = {"ID": "id", **{f["source"]: f["name"] for f in features}, training["label_source"]: label}
frame = public_data.read_credit_default(path, columns).astype({f["name"]: "float64" for f in features})

table = f"{catalog}.{schema}.scoring_training_data"
spark.createDataFrame(frame).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
print(f"Wrote {len(frame)} card holders to {table}; default rate {frame[label].mean():.3f}")
print(public_data.SOURCES[training["dataset"]]["citation"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Train the pipeline
# MAGIC
# MAGIC The first step adds any omitted optional feature as NaN, and the imputer fills it with the training median. That lets the endpoint accept requests that leave the optional feature out.

# COMMAND ----------

from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer

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

# COMMAND ----------

# MAGIC %md
# MAGIC ## Register in Unity Catalog
# MAGIC
# MAGIC The MLflow signature marks the optional feature as not required.

# COMMAND ----------

import mlflow
from mlflow import MlflowClient
from mlflow.models import ModelSignature
from mlflow.types import ColSpec, Schema
from databricks.sdk import WorkspaceClient

signature = ModelSignature(
    inputs=Schema([ColSpec("double", f["name"], required=not f.get("optional", False)) for f in features]),
    outputs=Schema([ColSpec("long")]),
)

mlflow.set_registry_uri("databricks-uc")
user = WorkspaceClient().current_user.me().user_name
mlflow.set_experiment(f"/Users/{user}/capability-guides-realtime-scoring")
full_name = f"{catalog}.{schema}.{model_spec['name']}"
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

MlflowClient(registry_uri="databricks-uc").set_registered_model_alias(full_name, model_spec["alias"], version)
print(f"Registered {full_name} version {version} with alias {model_spec['alias']}")
dbutils.jobs.taskValues.set(key="model_name", value=full_name)
dbutils.jobs.taskValues.set(key="model_version", value=version)
