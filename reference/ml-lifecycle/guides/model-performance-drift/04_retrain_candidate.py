# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Train a challenger
# MAGIC
# MAGIC Runs when drift is found. Trains a candidate on the training data plus the drifted batches (all but the last), then compares it with the current `prod` model on the last batch. It registers the candidate with the `challenger` alias and adds a row to `retraining_log`, which is a log. A person decides whether to promote it. In the job, the first breached batch comes from `03_detect_drift`. Run by hand, the notebook reads it from `drift_metrics`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_drift", ['catalog', 'schema', 'use_case', 'experiment'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
import mlflow
import mlflow.sklearn
import pandas as pd
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient
from pyspark.sql import functions as F
from sklearn.metrics import roc_auc_score

# COMMAND ----------

features, label, key = spec["model"]["features"], spec["label"]["name"], spec["source"]["key"]
model_name = f"{catalog}.{schema}.{spec['model']['drift_name']}"

def task_value(task_key, key):
    """The value an upstream job task passed on, or None when this notebook runs on its own."""
    try:
        return dbutils.jobs.taskValues.get(taskKey=task_key, key=key, default=None, debugValue=None)
    except ValueError:
        return None

first = task_value("detect_drift", "first_breach_batch")
if first is None:
    first = spark.table(c.fq(catalog, schema, "drift_metrics")).where("breached").agg(F.min("batch_id")).first()[0]
if first is None or str(first) == "None":
    dbutils.notebook.exit("No feature breached its drift threshold, so there is nothing to retrain for.")
first = int(first)

train_base = spark.table(c.fq(catalog, schema, "drift_training_data")).toPandas()
scores = spark.table(c.fq(catalog, schema, "batch_scores")).toPandas()
recent = scores[scores["batch_id"] >= first]

# Hold out the last batch to compare the current @prod model with the candidate on the new distribution.
last = recent["batch_id"].max()
eval_set = recent[recent["batch_id"] == last]
fit_set = pd.concat([train_base[[key, *features, label]], recent[recent["batch_id"] != last][[key, *features, label]]])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Train the candidate and compare it with prod

# COMMAND ----------

mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment(params["experiment"])
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
).withColumn("created_at", F.current_timestamp()).write.mode("append").saveAsTable(c.fq(catalog, schema, "retraining_log"))
print(f"Challenger v{info.registered_model_version}: AUC {cand_auc:.4f} vs @prod {prod_auc:.4f} on batch {last}")
