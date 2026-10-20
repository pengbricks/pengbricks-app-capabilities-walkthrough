# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Tracked run
# MAGIC
# MAGIC Writes `experiment_data` (the 2010-09-01 customer snapshot, overwritten on each run), trains on that exact Delta version, and logs the metric with the references needed to reproduce it: data table and version, release, a hash of the training code, and the package versions.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_experiment_rerun", ['catalog', 'schema', 'use_case', 'release', 'experiment', 'source_volume'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
import json
import mlflow

# COMMAND ----------

table = c.fq(catalog, schema, "experiment_data")
transactions = c.fq(catalog, schema, spec["source"]["transactions_table"])
c.ensure_transactions(spark, spec, transactions, f"/Volumes/{catalog}/{schema}/{params['source_volume']}")
c.snapshot_frame(spark, spec, transactions).write.mode("overwrite") \
    .option("overwriteSchema", "true").saveAsTable(table)
version = c.delta_version(spark, table)
pdf = spark.sql(f"SELECT * FROM {table} VERSION AS OF {version}").toPandas()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Train and record the references

# COMMAND ----------

mlflow.set_experiment(params["experiment"])
with mlflow.start_run(run_name="tracked-run") as run:
    _, auc, _ = c.train_and_score(pdf, spec)
    mlflow.log_params({"seed": spec["seed"], "rows": len(pdf), "features": ",".join(spec["model"]["features"])})
    mlflow.log_metric("holdout_auc", auc)
    mlflow.set_tags({
        "data_table": table.replace("`", ""), "data_version": str(version),
        "git_sha": params["release"], "code_hash": c.code_hash(),
        "environment": json.dumps(c.environment_versions()),
    })
    run_id = run.info.run_id
dbutils.jobs.taskValues.set(key="run_id", value=run_id)
print(f"Tracked run {run_id}: data version {version}, release {params['release']}, AUC {auc:.6f}")
