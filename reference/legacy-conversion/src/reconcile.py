"""Task 3: generate sample data, run the converted pipeline in the target schema,
and reconcile outputs against the independent Python reference implementation."""
import datetime
from lc_common import fq, load_spec, parse_args, write_table
import lc_datagen
import lc_expected as ex
import lc_helpers as h
from pyspark.sql import SparkSession

args = parse_args()
spark = SparkSession.builder.getOrCreate()
spec = load_spec(args.bundle_root, args.use_case)
w, sd = spec["workload"], spec["sample_data"]
cat, sch = args.catalog, args.schema

# 1. Reset outputs and temp tables so the job can be re-run.
for t in w["reset_tables"]:
    spark.sql(f"DROP TABLE IF EXISTS {fq(cat, sch, t)}")
for row in spark.sql(f"SHOW TABLES IN `{cat}`.`{sch}`").collect():
    if row.tableName.startswith(w["temp_table_prefix"]):
        spark.sql(f"DROP TABLE IF EXISTS {fq(cat, sch, row.tableName)}")

# 2. Generate sample input.
df, generator = lc_datagen.generate(spark, spec)
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(fq(cat, sch, sd["source_table"]))
source_rows = [r.asDict() for r in spark.table(fq(cat, sch, sd["source_table"])).collect()]
print(f"generated {len(source_rows)} source rows with {generator}")

# 3. Run the converted pipeline step by step.
checks = []
conv_rows = spark.table(fq(cat, sch, "assessment_conversion")).orderBy("step_id").collect()
for r in conv_rows:
    if not r.executable_sql:
        continue
    err = ""
    try:
        for stmt in h.split_statements(r.executable_sql):
            spark.sql(stmt)
    except Exception as e:
        err = str(e).splitlines()[0][:300]
    checks.append({"check_name": f"step_{r.step_id:02d}.{r.step_name}.executes", "table_name": "", "check_type": "step_execution",
                   "expected": "success", "actual": err or "success", "passed": not err})
    print(f"step {r.step_id:02d} {r.step_name} ({r.executed_from}): {err or 'ok'}")

# 4. Reconcile each output table against the reference implementation.
expected = ex.build_expected(source_rows, spec["expected"])
for name, cfg in spec["expected"]["tables"].items():
    try:
        actual = [x.asDict() for x in spark.table(fq(cat, sch, name)).collect()]
    except Exception as e:
        checks.append({"check_name": f"{name}.exists", "table_name": name, "check_type": "table_exists", "expected": "table",
                       "actual": str(e).splitlines()[0][:200], "passed": False})
        continue
    checks += ex.reconcile_table(name, expected[name], actual, cfg)

# 5. Drop temp tables and record results.
for row in spark.sql(f"SHOW TABLES IN `{cat}`.`{sch}`").collect():
    if row.tableName.startswith(w["temp_table_prefix"]):
        spark.sql(f"DROP TABLE IF EXISTS {fq(cat, sch, row.tableName)}")
ts = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
rows = [(c["check_name"], c["table_name"], c["check_type"], c["expected"], c["actual"], bool(c["passed"]), ts) for c in checks]
write_table(spark, rows, "check_name STRING, table_name STRING, check_type STRING, expected STRING, actual STRING, passed BOOLEAN, checked_at TIMESTAMP",
            cat, sch, "assessment_test_results")
failed = [c["check_name"] for c in checks if not c["passed"]]
print(f"{len(checks) - len(failed)} passed, {len(failed)} failed; generator={generator}")
for f in failed:
    print("FAILED:", f)
