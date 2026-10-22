# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Import the legacy model
# MAGIC
# MAGIC Logs the pickle as a pyfunc model, registers it in Unity Catalog as `churn_classifier_imported`, and reloads it to score the same holdout rows the baseline used (the training table at the version recorded in the sidecar JSON). The notebook fails if the reproduced AUC differs from the recorded baseline by more than the tolerance. `model_compatibility_log` lists the package versions recorded against the current ones; it is a log, so each run adds rows. Safe to rerun: the experiment is reused and `imported` is set, not added; each run registers a new model version (versions are history).

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_training", ['catalog', 'schema', 'use_case', 'release', 'experiment', 'volume'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
import json
import mlflow
import mlflow.pyfunc
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient
from pyspark.sql import functions as F
from sklearn.metrics import roc_auc_score

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the sidecar record and rebuild the holdout

# COMMAND ----------

base = f"/Volumes/{catalog}/{schema}/{params['volume']}"
with open(f"{base}/legacy_model.json") as handle:
    recorded = json.load(handle)
model_name = f"{catalog}.{schema}.{spec['model']['imported_name']}"
features, label = spec["model"]["features"], spec["label"]["name"]
tolerance = spec["model"]["baseline_tolerance"]

# Same rows the baseline used: the table version the legacy model recorded.
table = c.fq(catalog, schema, "model_training_data")
pdf = spark.sql(f"SELECT * FROM {table} VERSION AS OF {recorded['training_table_version']}").toPandas()
_, holdout = c.split_frame(pdf, spec["source"]["key"], spec["model"]["holdout_mod"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Log the pickle as a pyfunc and reproduce the baseline
# MAGIC
# MAGIC The wrapper class lives in `src/legacy_pyfunc.py`. MLflow logs that file as is, and the pickle travels as an artifact.

# COMMAND ----------

current = c.environment_versions()
mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment(params["experiment"])
with mlflow.start_run(run_name="import-legacy-pickle") as run:
    info = mlflow.pyfunc.log_model(
        name="model",
        python_model=str(ROOT / "src" / "legacy_pyfunc.py"),
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
    mlflow.set_tags({"release": params["release"], **{f"env_{k}": v for k, v in current.items()},
                     **{f"legacy_env_{k}": v for k, v in recorded["environment"].items()}})
    run_id = run.info.run_id
client = MlflowClient(registry_uri="databricks-uc")
client.set_registered_model_alias(model_name, "imported", info.registered_model_version)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Change log: what differs between the two runtimes

# COMMAND ----------

changes = c.diff_environment(recorded["environment"], current)
rows = [(k, recorded["environment"][k], current.get(k, "missing"), recorded["environment"][k] != current.get(k))
        for k in recorded["environment"]]
rows.append(("holdout_auc", f"{recorded['baseline_holdout_auc']:.6f}", f"{auc:.6f}", diff > tolerance))
log = spark.createDataFrame(rows, "item string, recorded string, current string, changed boolean") \
    .withColumn("model", F.lit(model_name)).withColumn("model_version", F.lit(str(info.registered_model_version))) \
    .withColumn("mlflow_run_id", F.lit(run_id)).withColumn("checked_at", F.current_timestamp())
log.write.mode("append").saveAsTable(c.fq(catalog, schema, "model_compatibility_log"))

print(f"Imported {model_name} v{info.registered_model_version}; baseline {recorded['baseline_holdout_auc']:.6f} "
      f"reproduced {auc:.6f} (diff {diff:.2e}, tolerance {tolerance}); package changes: {changes or 'none'}")
if diff > tolerance:
    raise RuntimeError(f"Reproduced AUC differs from baseline by {diff:.6f} (tolerance {tolerance})")
