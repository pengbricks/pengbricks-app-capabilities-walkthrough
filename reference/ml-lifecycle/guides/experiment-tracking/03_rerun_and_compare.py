# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Rerun and compare
# MAGIC
# MAGIC Reads the tracked run's tags, trains again on the recorded Delta version (`VERSION AS OF`, not the latest), and compares the AUC with the original. It also trains on the latest data as a control. The notebook fails if the AUC differs by more than the tolerance or the code hash changed. `experiment_reproductions` is a log: each run adds one row. Safe to rerun: the experiment is reused; each run adds one MLflow run and one log row.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_experiment_rerun", ['catalog', 'schema', 'use_case', 'experiment', 'run_id'], defaults={'run_id': 'latest'})
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
import json
import mlflow
from mlflow.tracking import MlflowClient
from pyspark.sql import functions as F

tolerance = spec["model"]["rerun_tolerance"]
client = MlflowClient()
mlflow.set_experiment(params["experiment"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pick the tracked run
# MAGIC
# MAGIC In the job, `01_tracked_run` passes its run ID. Run by hand with `run_id` blank, the notebook takes the latest `tracked-run` in the experiment.

# COMMAND ----------

run_id = params["run_id"]
if run_id == "latest":
    experiment = mlflow.get_experiment_by_name(params["experiment"])
    found = client.search_runs([experiment.experiment_id], filter_string="tags.mlflow.runName = 'tracked-run'",
                               order_by=["attributes.start_time DESC"], max_results=1)
    if not found:
        raise RuntimeError("No tracked-run in the experiment yet. Run 01_tracked_run first.")
    run_id = found[0].info.run_id
original = client.get_run(run_id)
tags, expected = original.data.tags, original.data.metrics["holdout_auc"]
table, version = tags["data_table"], int(tags["data_version"])
quoted = c.fq(*table.split("."))

env_changes = c.diff_environment(json.loads(tags["environment"]), c.environment_versions())
code_matches = tags["code_hash"] == c.code_hash()
latest = c.delta_version(spark, quoted)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Rerun on the recorded version

# COMMAND ----------

# Read the recorded version, not the latest one.
pdf = spark.sql(f"SELECT * FROM {quoted} VERSION AS OF {version}").toPandas()
latest_pdf = spark.sql(f"SELECT * FROM {quoted}").toPandas()

with mlflow.start_run(run_name="rerun") as run:
    _, auc, _ = c.train_and_score(pdf, spec)
    _, latest_auc, _ = c.train_and_score(latest_pdf, spec)
    diff = abs(auc - expected)
    ok = c.within_tolerance(expected, auc, tolerance) and code_matches
    mlflow.log_metrics({"holdout_auc": auc, "auc_difference": diff})
    mlflow.set_tags({
        "reproduces_run_id": run_id, "data_table": table, "data_version": str(version),
        "git_sha": tags["git_sha"], "code_hash": tags["code_hash"], "reproduced": str(ok).lower(),
    })
    rerun_id = run.info.run_id

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the comparison

# COMMAND ----------

row = [(run_id, rerun_id, table, version, latest, tags["git_sha"], code_matches, len(env_changes), expected, auc,
        diff, tolerance, ok, latest_auc)]
ddl = ("original_run_id string, rerun_id string, data_table string, data_version long, latest_data_version long, "
       "git_sha string, code_matches boolean, environment_changes int, original_auc double, rerun_auc double, "
       "auc_difference double, tolerance double, reproduced boolean, latest_data_auc double")
spark.createDataFrame(row, ddl).withColumn("checked_at", F.current_timestamp()) \
    .write.mode("append").saveAsTable(c.fq(catalog, schema, "experiment_reproductions"))
print(f"Original {expected:.6f}, rerun {auc:.6f} (diff {diff:.2e}, tolerance {tolerance}); data version {version} "
      f"of {latest}; code match {code_matches}; env changes {env_changes or 'none'}; "
      f"latest-data AUC {latest_auc:.6f}")
if not ok:
    raise RuntimeError("Rerun did not reproduce the tracked run")
