"""Guide 4, task 3: compare each batch's feature distributions with the training baseline."""

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


def main() -> None:
    spec = c.load_spec(args.spec)
    d = spec["drift"]
    features = spec["model"]["features"]
    baseline = spark.table(c.fq(args.catalog, args.schema, "drift_training_data")).select(*features).toPandas()
    scores = spark.table(c.fq(args.catalog, args.schema, "batch_scores")).toPandas()

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
    df.write.mode("append").saveAsTable(c.fq(args.catalog, args.schema, "drift_metrics"))

    breached = [(r[0], r[1], round(r[2], 3), round(r[3], 2)) for r in rows if r[6]]
    first = min((b[0] for b in breached), default=None)
    dbutils.jobs.taskValues.set(key="breach", value="true" if breached else "false")
    dbutils.jobs.taskValues.set(key="first_breach_batch", value=str(first))
    print(f"{len(breached)} breaches (batch, feature, psi, mean shift sd): {breached}")


main()
