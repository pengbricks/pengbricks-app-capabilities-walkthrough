# Databricks notebook source
# MAGIC %pip install -q "databricks-feature-engineering>=0.13"

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Build the feature table
# MAGIC
# MAGIC Builds the feature table in Unity Catalog from the source table, then runs quality checks: key not null and unique, no nulls, and inclusive ranges from the spec. The table is dropped and rebuilt on each run, and the check results for it are replaced. The notebook fails if a check fails.

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

# MAGIC %md
# MAGIC ## Create the feature table

# COMMAND ----------

def create_feature_table(name: str, key: str, df, description: str) -> str:
    """Prefer the Feature Engineering client; fall back to a primary-key Delta table."""
    spark.sql(f"DROP TABLE IF EXISTS {name}")
    try:
        from databricks.feature_engineering import FeatureEngineeringClient

        FeatureEngineeringClient().create_table(name=name.replace("`", ""), primary_keys=[key], df=df, description=description)
        return "feature_engineering_client"
    except Exception as exc:  # noqa: BLE001 - record the reason, keep the guide working
        print(f"Feature Engineering client unavailable ({type(exc).__name__}: {exc}); using a primary-key Delta table")
        spark.sql(f"DROP TABLE IF EXISTS {name}")
        df.write.mode("overwrite").saveAsTable(name)
        spark.sql(f"ALTER TABLE {name} ALTER COLUMN `{key}` SET NOT NULL")
        spark.sql(f"ALTER TABLE {name} ADD CONSTRAINT {name.split('.')[-1].strip('`')}_pk PRIMARY KEY (`{key}`)")
        return "primary_key_delta_table"


key = spec["source"]["key"]
source = c.fq(catalog, schema, spec["source"]["table"])
target = c.fq(catalog, schema, spec["features"]["table"])
results_table = c.fq(catalog, schema, "feature_quality_results")

feats = spec["features"]
cols = [F.col(key), *[F.col(n) for n in feats["passthrough"]]]
cols += [F.expr(d["expr"]).alias(d["name"]) for d in feats["derived"]]
df = spark.table(source).select(*cols)

method = create_feature_table(target, key, df, "Customer activity features derived from the source table")
version = c.delta_version(spark, target)
source_version = c.delta_version(spark, source)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run the quality checks

# COMMAND ----------

checks = c.quality_queries(target, key, c.feature_columns(spec), feats["ranges"])
rows = []
for name, sql in checks:
    violations = int(spark.sql(sql).collect()[0][0])
    rows.append((name, target.replace("`", ""), violations, violations == 0, version))
results = spark.createDataFrame(
    rows, "check_name string, table_name string, violations long, passed boolean, table_version long"
).withColumn("checked_at", F.current_timestamp())
# A rerun replaces this table's check results instead of adding a second set.
spark.sql(
    f"CREATE TABLE IF NOT EXISTS {results_table} (check_name string, table_name string, violations long, "
    "passed boolean, table_version long, checked_at timestamp)"
)
spark.sql(f"DELETE FROM {results_table} WHERE table_name = '{target.replace(chr(96), '')}'")
results.write.mode("append").option("mergeSchema", "true").saveAsTable(results_table)

failed = [r[0] for r in rows if not r[3]]
dbutils.jobs.taskValues.set(key="feature_version", value=version)
dbutils.jobs.taskValues.set(key="source_version", value=source_version)
dbutils.jobs.taskValues.set(key="method", value=method)
print(f"Feature table {target} via {method}, Delta version {version}, {len(rows)} checks, {len(failed)} failed")
if failed:
    raise RuntimeError(f"Quality checks failed: {failed}")
