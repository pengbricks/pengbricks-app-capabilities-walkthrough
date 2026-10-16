# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Train and register
# MAGIC
# MAGIC Generates the training data from the spec (same spec and seed give the same rows), trains a scikit-learn pipeline, logs it with MLflow 3, and registers a new version in Unity Catalog with release tags.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_release", ['catalog', 'schema', 'use_case', 'release', 'experiment'])
dbutils.widgets.text("job_run_id", "")
job_run_id = dbutils.widgets.get("job_run_id").strip()

import common
import mlflow
import mlflow.sklearn
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

catalog, schema, release = params["catalog"], params["schema"], params["release"]
spec = common.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
model_name = common.full_model_name(catalog, schema, spec)
table = common.training_table(catalog, schema, spec)
features, label = spec["features"], spec["label"]["name"]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Generate and persist the training data
# MAGIC
# MAGIC The table is overwritten on each run, so the tests read the identical rows.

# COMMAND ----------

df = common.build_training_frame(spark, spec)
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
pdf = spark.table(table).toPandas()
train, holdout = common.split_frame(pdf, spec)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Train, log and register

# COMMAND ----------

mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment(params["experiment"])
pipeline = Pipeline(
    [("scale", StandardScaler()), ("model", GradientBoostingClassifier(random_state=spec["seed"] % 2**31))]
)

with mlflow.start_run(run_name=f"train-{release[:7]}") as run:
    pipeline.fit(train[features], train[label])
    auc = roc_auc_score(holdout[label], pipeline.predict_proba(holdout[features])[:, 1])
    mlflow.log_params({"seed": spec["seed"], "rows": len(pdf), "features": ",".join(features)})
    mlflow.log_metrics({"holdout_auc": auc, "positive_rate": float(pdf[label].mean())})
    mlflow.set_tags({"release": release, "git_sha": release, "training_table": table})
    info = mlflow.sklearn.log_model(
        pipeline,
        name="model",
        signature=infer_signature(train[features], pipeline.predict(train[features])),
        input_example=train[features].head(3),
        registered_model_name=model_name,
    )
    run_id = run.info.run_id
    experiment_id = run.info.experiment_id

# COMMAND ----------

# MAGIC %md
# MAGIC ## Tag the model version

# COMMAND ----------

version = str(info.registered_model_version)
host = spark.conf.get("spark.databricks.workspaceUrl", "")
client = MlflowClient(registry_uri="databricks-uc")
for key, value in {
    "release": release,
    "git_sha": release,
    "training_run_id": run_id,
    "training_run_url": common.run_url(f"https://{host}", experiment_id, run_id) if host else "",
    "job_run_id": job_run_id,
    "holdout_auc": f"{auc:.4f}",
}.items():
    client.set_model_version_tag(model_name, version, key, value)

dbutils.jobs.taskValues.set(key="model_version", value=version)
dbutils.jobs.taskValues.set(key="holdout_auc", value=round(auc, 4))
print(f"Registered {model_name} version {version}, holdout AUC {auc:.4f}")
