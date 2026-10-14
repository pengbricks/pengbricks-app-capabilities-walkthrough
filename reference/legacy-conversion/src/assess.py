"""Task 1: split the legacy script into steps and classify each by construct."""
from lc_common import fq, load_spec, parse_args, read_text
import lc_helpers as h
from pyspark.sql import SparkSession

args = parse_args()
spark = SparkSession.builder.getOrCreate()
spec = load_spec(args.bundle_root, args.use_case)
spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{args.catalog}`.`{args.schema}`")

steps = h.split_steps(read_text(args.bundle_root, spec["workload"]["legacy_sql"]))
rows = []
for s in steps:
    primary, tags = h.classify(s.sql)
    rows.append((s.step_id, s.name, primary, ",".join(tags), s.sql))
    print(f"step {s.step_id:02d} {s.name}: {primary} [{', '.join(tags)}]")

df = spark.createDataFrame(rows, "step_id INT, step_name STRING, construct STRING, tags STRING, legacy_sql STRING")
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(fq(args.catalog, args.schema, "assessment_classification"))
print(f"classified {len(rows)} statements")
