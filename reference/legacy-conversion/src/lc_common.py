"""Shared notebook plumbing: spec loading, Spark helpers."""
import os
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load_spec(bundle_root, use_case):
    with open(os.path.join(bundle_root, "use_cases", f"{use_case}.yml")) as f:
        return yaml.safe_load(f)


def read_text(bundle_root, rel):
    with open(os.path.join(bundle_root, rel)) as f:
        return f.read()


def fq(catalog, schema, table):
    return f"`{catalog}`.`{schema}`.`{table}`"


def write_table(spark, rows, schema_ddl, catalog, schema, table):
    df = spark.createDataFrame(rows, schema=schema_ddl)
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(fq(catalog, schema, table))
    print(f"wrote {len(rows)} rows to {fq(catalog, schema, table)}")
