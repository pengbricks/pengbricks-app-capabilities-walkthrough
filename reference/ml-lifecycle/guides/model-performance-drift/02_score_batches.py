# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Score the batches
# MAGIC
# MAGIC Loads the `prod` model and scores five generated batches. Batches from `drift_from_batch` on carry the shifted feature. Three tables record the results: `batch_scores`, `ops_metrics` (speed and null rate) and `model_metrics` (AUC, accuracy and positive rates). All three are overwritten on each run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_drift", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
import time
import mlflow
import mlflow.sklearn
import pandas as pd
from pyspark.sql import functions as F
from sklearn.metrics import accuracy_score, roc_auc_score

# COMMAND ----------

d = spec["drift"]
model_name = f"{catalog}.{schema}.{spec['model']['drift_name']}"
features, label = spec["model"]["features"], spec["label"]["name"]
mlflow.set_registry_uri("databricks-uc")
model = mlflow.sklearn.load_model(f"models:/{model_name}@prod")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Score each batch

# COMMAND ----------

scores, ops, quality = [], [], []
for batch in range(1, d["batches"] + 1):
    drifted = batch >= d["drift_from_batch"]
    pdf = c.build_frame(spark, spec, d["batch_rows"], spec["seed"] + 100 + batch, id_offset=1_000_000 * batch,
                        shift=d["shift"] if drifted else None).toPandas()
    start = time.perf_counter()
    proba = model.predict_proba(pdf[features])[:, 1]
    seconds = time.perf_counter() - start
    pred = (proba >= 0.5).astype(int)
    ops.append((batch, len(pdf), seconds, len(pdf) / seconds if seconds else 0.0,
                float(pdf[features].isna().any(axis=1).mean()), drifted))
    quality.append((batch, float(roc_auc_score(pdf[label], proba)), float(accuracy_score(pdf[label], pred)), float(pdf[label].mean()), float(pred.mean()), drifted))
    out = pdf[[spec["source"]["key"], *features, label]].copy()
    out["batch_id"], out["prediction"], out["score"] = batch, pred, proba
    scores.append(out)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the results

# COMMAND ----------

ts = F.current_timestamp()
spark.createDataFrame(pd.concat(scores)).withColumn("scored_at", ts) \
    .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(c.fq(catalog, schema, "batch_scores"))
spark.createDataFrame(ops, "batch_id int, rows long, scoring_seconds double, rows_per_second double, null_rate double, drifted_input boolean") \
    .withColumn("scored_at", ts).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(c.fq(catalog, schema, "ops_metrics"))
spark.createDataFrame(quality, "batch_id int, auc double, accuracy double, actual_positive_rate double, predicted_positive_rate double, drifted_input boolean") \
    .withColumn("scored_at", ts).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(c.fq(catalog, schema, "model_metrics"))
for q in quality:
    print(f"batch {q[0]}: auc {q[1]:.4f} accuracy {q[2]:.4f} actual rate {q[3]:.3f} predicted rate {q[4]:.3f} drifted_input={q[5]}")
