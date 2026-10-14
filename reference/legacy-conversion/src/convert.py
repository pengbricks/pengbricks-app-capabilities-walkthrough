"""Task 2: transpile each step with sqlglot, record clean/warning/manual, and attach
the hand-remediated SQL for steps that need it."""
from lc_common import fq, load_spec, parse_args, read_text
import lc_helpers as h
from pyspark.sql import SparkSession

args = parse_args()
spark = SparkSession.builder.getOrCreate()
spec = load_spec(args.bundle_root, args.use_case)
w = spec["workload"]
cs = f"`{args.catalog}`.`{args.schema}`"
remediation = {s.step_id: s for s in h.split_steps(read_text(args.bundle_root, w["remediation_sql"]))}

rows = []
for r in spark.table(fq(args.catalog, args.schema, "assessment_classification")).orderBy("step_id").collect():
    conv = h.convert_statement(r.legacy_sql, args.catalog, args.schema, w["legacy_schema"], w["temp_table_prefix"])
    manual_sql, executable, source = "", "", "none"
    if conv.status == "manual":
        rem = remediation.get(r.step_id)
        if rem is not None and rem.sql:
            manual_sql = rem.sql.replace("{cs}", cs)
            executable, source = manual_sql, "manual"
        else:
            conv.notes.append("Remediation recorded as a non-SQL change (no statement to run).")
    else:
        executable, source = conv.converted_sql, "auto"
    rows.append((r.step_id, r.step_name, r.construct, conv.status, " | ".join(conv.notes),
                 r.legacy_sql, conv.converted_sql, manual_sql, executable, source))
    print(f"step {r.step_id:02d} {r.step_name}: {conv.status} ({source})")

df = spark.createDataFrame(rows, "step_id INT, step_name STRING, construct STRING, status STRING, notes STRING, "
                                 "legacy_sql STRING, converted_sql STRING, manual_sql STRING, executable_sql STRING, executed_from STRING")
df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(fq(args.catalog, args.schema, "assessment_conversion"))
