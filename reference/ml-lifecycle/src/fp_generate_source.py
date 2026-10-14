"""Guide 1, task 1: generate the source table from the use-case spec."""

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

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    table = c.fq(args.catalog, args.schema, spec["source"]["table"])
    df = c.build_frame(spark, spec, spec["source"]["rows"], spec["seed"])
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    version = c.delta_version(spark, table)
    nulls = spark.sql(f"SELECT count(*) FROM {table} WHERE usage_score IS NULL").collect()[0][0]
    dbutils.jobs.taskValues.set(key="source_version", value=version)
    print(f"Wrote {spark.table(table).count()} rows to {table} (Delta version {version}, {nulls} null usage_score)")


main()
