"""Guide 2, task 1: stand in for a model trained elsewhere.

Trains a scikit-learn pipeline, pickles it to a Unity Catalog volume with plain `pickle`, and writes
its recorded baseline metric and library versions next to it. No MLflow is involved.
"""

import argparse
import json
import pickle
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--volume", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
args = p.parse_args()
sys.path.insert(0, args.src_dir)

from databricks.sdk.runtime import spark

import ml_common as c


def main() -> None:
    spec = c.load_spec(args.spec)
    table = c.fq(args.catalog, args.schema, "model_training_data")
    df = c.build_frame(spark, spec, spec["source"]["rows"], spec["seed"])
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(table)
    pdf = spark.table(table).toPandas()
    pipeline, auc, _ = c.train_and_score(pdf, spec)

    base = f"/Volumes/{args.catalog}/{args.schema}/{args.volume}"
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


main()
