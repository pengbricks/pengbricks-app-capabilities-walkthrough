# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Detect drift
# MAGIC
# MAGIC Compares each scored batch with the training data, feature by feature: PSI (population stability index, with baseline quantile bins) and the mean shift in baseline standard deviations. A feature breaches when either passes its threshold from the spec. Results go to `drift_metrics`, which is overwritten, so it always holds the current batches. The notebook passes `breach` and `first_breach_batch` to the job's condition task.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_drift", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]

import ml_common as c
ROOT = bundle_root()
spec = c.load_spec(str(ROOT / "use_cases" / f"{params['use_case']}.yml"))
from pyspark.sql import functions as F

# COMMAND ----------

d = spec["drift"]
features = spec["model"]["features"]
baseline = spark.table(c.fq(catalog, schema, "drift_training_data")).select(*features).toPandas()
scores = spark.table(c.fq(catalog, schema, "batch_scores")).toPandas()

# COMMAND ----------

rows = []
for batch, frame in scores.groupby("batch_id"):
    for feature in features:
        p_value = c.psi(baseline[feature], frame[feature])
        shift = c.mean_shift(baseline[feature], frame[feature])
        rows.append((int(batch), feature, p_value, shift, d["psi_threshold"], d["mean_shift_threshold"],
                     c.is_breach(p_value, shift, d["psi_threshold"], d["mean_shift_threshold"])))
df = spark.createDataFrame(
    rows, "batch_id int, feature string, psi double, mean_shift_sd double, psi_threshold double, "
          "mean_shift_threshold double, breached boolean",
).withColumn("computed_at", F.current_timestamp())
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(c.fq(catalog, schema, "drift_metrics"))  # current batches only; a rerun replaces them

breached = [(r[0], r[1], round(r[2], 3), round(r[3], 2)) for r in rows if r[6]]
first = min((b[0] for b in breached), default=None)
dbutils.jobs.taskValues.set(key="breach", value="true" if breached else "false")
dbutils.jobs.taskValues.set(key="first_breach_batch", value=str(first))
print(f"{len(breached)} breaches (batch, feature, psi, mean shift sd): {breached}")
