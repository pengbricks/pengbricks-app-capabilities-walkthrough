# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Snapshot the training set
# MAGIC
# MAGIC Freezes a versioned training set: the feature table at one Delta version joined to the labels at one source version. In the job, the versions come from `02_build_features`. Run by hand, the notebook uses the latest version of each table. The snapshot name carries the feature version, and each snapshot has one entry in `training_set_versions`. Safe to rerun: the snapshot table is overwritten and its registry entry is replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_feature_preparation", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
spec = c.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
from pyspark.sql import functions as F

# COMMAND ----------

key, label = spec["source"]["key"], spec["label"]["name"]
features = c.fq(catalog, schema, spec["features"]["table"])
source = c.fq(catalog, schema, spec["source"]["table"])

def task_value(task_key, key):
    """The value an upstream job task passed on, or None when this notebook runs on its own."""
    try:
        return dbutils.jobs.taskValues.get(taskKey=task_key, key=key, default=None, debugValue=None)
    except ValueError:
        return None

fv = task_value("build_features", "feature_version")
sv = task_value("build_features", "source_version")
fv = int(fv) if fv is not None else c.delta_version(spark, features)
sv = int(sv) if sv is not None else c.delta_version(spark, source)
snapshot_name = f"{spec['features']['training_set_prefix']}{fv}"
snapshot = c.fq(catalog, schema, snapshot_name)
registry = c.fq(catalog, schema, "training_set_versions")
print(f"Feature table version {fv}, source version {sv}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Join at the recorded versions and save

# COMMAND ----------

feats = spark.sql(f"SELECT * FROM {features} VERSION AS OF {fv}")
labels = spark.sql(f"SELECT `{key}`, `{label}` FROM {source} VERSION AS OF {sv}")
train = feats.join(labels, key, "inner")
train.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(snapshot)
spark.sql(
    f"ALTER TABLE {snapshot} SET TBLPROPERTIES ('feature_table_version' = '{fv}', 'source_table_version' = '{sv}')"
)

rows = spark.table(snapshot).count()
time_travel_rows = spark.sql(f"SELECT count(*) FROM {features} VERSION AS OF {fv}").collect()[0][0]
if rows != time_travel_rows:
    raise RuntimeError(f"Snapshot has {rows} rows, feature table version {fv} has {time_travel_rows}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Register the snapshot

# COMMAND ----------

entry = spark.createDataFrame(
    [(snapshot.replace("`", ""), features.replace("`", ""), fv, source.replace("`", ""), sv, rows)],
    "training_set string, feature_table string, feature_table_version long, "
    "source_table string, source_table_version long, row_count long",
).withColumn("created_at", F.current_timestamp())
spark.sql(
    f"CREATE TABLE IF NOT EXISTS {registry} (training_set string, feature_table string, feature_table_version long, "
    "source_table string, source_table_version long, row_count long, created_at timestamp)"
)
spark.sql(f"DELETE FROM {registry} WHERE training_set = '{snapshot.replace(chr(96), '')}'")  # one entry per snapshot
entry.write.mode("append").saveAsTable(registry)
dbutils.jobs.taskValues.set(key="training_set", value=snapshot_name)
print(f"Training set {snapshot}: {rows} rows from feature version {fv} and source version {sv}")
