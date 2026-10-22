# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Export the legacy model
# MAGIC
# MAGIC Plays the part of the old runtime. Downloads UCI Online Retail II (CC BY 4.0) if the volume does not have it yet, builds the churn training table, trains a model, pickles it into the `legacy_models` volume, and writes a sidecar JSON with the baseline AUC, the training table version and the package versions in use. Both files are overwritten on each run. Safe to rerun: the training table is overwritten, the source download is skipped when the verified file is there, and the volume files are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_training", ['catalog', 'schema', 'use_case', 'volume', 'source_volume'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
import json
import pickle

# COMMAND ----------

table = c.fq(catalog, schema, "model_training_data")
transactions = c.fq(catalog, schema, spec["source"]["transactions_table"])
c.ensure_transactions(spark, spec, transactions, f"/Volumes/{catalog}/{schema}/{params['source_volume']}")
df = c.snapshot_frame(spark, spec, transactions)
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
pdf = spark.table(table).toPandas()
pipeline, auc, _ = c.train_and_score(pdf, spec)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the pickle and the sidecar record

# COMMAND ----------

base = f"/Volumes/{catalog}/{schema}/{params['volume']}"
with open(f"{base}/legacy_model.pkl", "wb") as handle:
    pickle.dump(pipeline, handle)
record = {
    "baseline_holdout_auc": auc,
    "features": spec["model"]["features"],
    "training_table": table.replace("`", ""),
    "training_table_version": c.delta_version(spark, table),
    "environment": c.environment_versions(),
}
with open(f"{base}/legacy_model.json", "w") as handle:
    json.dump(record, handle, indent=2)
print(f"Pickled legacy model to {base}/legacy_model.pkl; recorded baseline AUC {auc:.6f}")
