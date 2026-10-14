"""Guide 1, task 2: build the feature table in Unity Catalog and run quality checks."""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

from databricks.sdk.runtime import dbutils, spark
from pyspark.sql import functions as F

import ml_common as c


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


def main() -> None:
    spec = c.load_spec(args.spec)
    key = spec["source"]["key"]
    source = c.fq(args.catalog, args.schema, spec["source"]["table"])
    target = c.fq(args.catalog, args.schema, spec["features"]["table"])
    results_table = c.fq(args.catalog, args.schema, "feature_quality_results")

    feats = spec["features"]
    cols = [F.col(key), *[F.col(n) for n in feats["passthrough"]]]
    cols += [F.expr(d["expr"]).alias(d["name"]) for d in feats["derived"]]
    df = spark.table(source).select(*cols)

    method = create_feature_table(target, key, df, "Customer activity features derived from the source table")
    version = c.delta_version(spark, target)
    source_version = c.delta_version(spark, source)

    checks = c.quality_queries(target, key, c.feature_columns(spec), feats["ranges"])
    rows = []
    for name, sql in checks:
        violations = int(spark.sql(sql).collect()[0][0])
        rows.append((name, target.replace("`", ""), violations, violations == 0, version))
    results = spark.createDataFrame(
        rows, "check_name string, table_name string, violations long, passed boolean, table_version long"
    ).withColumn("checked_at", F.current_timestamp())
    results.write.mode("append").option("mergeSchema", "true").saveAsTable(results_table)

    failed = [r[0] for r in rows if not r[3]]
    dbutils.jobs.taskValues.set(key="feature_version", value=version)
    dbutils.jobs.taskValues.set(key="source_version", value=source_version)
    dbutils.jobs.taskValues.set(key="method", value=method)
    print(f"Feature table {target} via {method}, Delta version {version}, {len(rows)} checks, {len(failed)} failed")
    if failed:
        raise RuntimeError(f"Quality checks failed: {failed}")


main()
