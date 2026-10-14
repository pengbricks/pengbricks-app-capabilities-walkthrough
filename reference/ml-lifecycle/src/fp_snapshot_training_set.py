"""Guide 1, task 3: freeze a versioned training set from the feature table and the labels."""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--feature-version", required=True)
p.add_argument("--source-version", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

from databricks.sdk.runtime import dbutils, spark
from pyspark.sql import functions as F

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    key, label = spec["source"]["key"], spec["label"]["name"]
    fv, sv = int(args.feature_version), int(args.source_version)
    features = c.fq(args.catalog, args.schema, spec["features"]["table"])
    source = c.fq(args.catalog, args.schema, spec["source"]["table"])
    snapshot_name = f"{spec['features']['training_set_prefix']}{fv}"
    snapshot = c.fq(args.catalog, args.schema, snapshot_name)
    registry = c.fq(args.catalog, args.schema, "training_set_versions")

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

    entry = spark.createDataFrame(
        [(snapshot.replace("`", ""), features.replace("`", ""), fv, source.replace("`", ""), sv, rows)],
        "training_set string, feature_table string, feature_table_version long, "
        "source_table string, source_table_version long, row_count long",
    ).withColumn("created_at", F.current_timestamp())
    entry.write.mode("append").saveAsTable(registry)
    dbutils.jobs.taskValues.set(key="training_set", value=snapshot_name)
    print(f"Training set {snapshot}: {rows} rows from feature version {fv} and source version {sv}")


main()
