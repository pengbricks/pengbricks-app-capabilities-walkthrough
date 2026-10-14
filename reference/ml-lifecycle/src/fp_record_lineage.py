"""Guide 1, task 4: read Unity Catalog table lineage for the feature table and training set."""

import argparse
import sys
import time

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--training-set", required=True)
p.add_argument("--wait-seconds", type=int, default=300)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

from databricks.sdk import WorkspaceClient
from databricks.sdk.runtime import spark
from pyspark.sql import functions as F

import ml_common as c


def upstreams(w: WorkspaceClient, table: str) -> list[str]:
    resp = w.api_client.do("GET", "/api/2.0/lineage-tracking/table-lineage", query={"table_name": table, "include_entity_lineage": "false"})
    return sorted(
        f"{u['tableInfo']['catalog_name']}.{u['tableInfo']['schema_name']}.{u['tableInfo']['name']}"
        for u in resp.get("upstreams", [])
        if "tableInfo" in u
    )


def main() -> None:
    spec = c.load_spec(args.spec)
    w = WorkspaceClient()
    plain = lambda name: f"{args.catalog}.{args.schema}.{name}"  # noqa: E731
    targets = {
        plain(spec["features"]["table"]): plain(spec["source"]["table"]),
        plain(args.training_set): plain(spec["features"]["table"]),
    }
    deadline = time.time() + args.wait_seconds
    found: dict[str, list[str]] = {}
    while True:
        for target in targets:
            found[target] = upstreams(w, target)
        if all(expected in found[t] for t, expected in targets.items()) or time.time() > deadline:
            break
        print("Lineage not visible yet; waiting 30s")
        time.sleep(30)

    rows = [(t, e, e in found[t], ",".join(found[t])) for t, e in targets.items()]
    df = spark.createDataFrame(
        rows, "table_name string, expected_upstream string, found boolean, all_upstreams string"
    ).withColumn("checked_at", F.current_timestamp())
    df.write.mode("append").saveAsTable(c.fq(args.catalog, args.schema, "feature_lineage"))
    for r in rows:
        print(f"{r[0]} <- {r[3] or 'no upstream yet'} (expected {r[1]}: {r[2]})")


main()
