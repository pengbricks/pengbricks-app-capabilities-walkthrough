"""Guide 3, task 2: land new rows after the tracked run, so the table moves past the recorded version."""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

from databricks.sdk.runtime import spark

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    table = c.fq(args.catalog, args.schema, "experiment_data")
    before = c.delta_version(spark, table)
    rows = spec["source"]["rows"] // 10
    new = c.build_frame(spark, spec, rows, spec["seed"] + 1, id_offset=spec["source"]["rows"])
    new.write.mode("append").saveAsTable(table)
    print(f"Appended {rows} rows: table moved from version {before} to {c.delta_version(spark, table)}")


main()
