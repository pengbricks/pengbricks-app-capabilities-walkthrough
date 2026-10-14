"""Task 4: write assessment_statements, assessment_summary and assessment_effort,
and log the run to etl_log."""
import datetime
from lc_common import fq, load_spec, parse_args, write_table
import lc_helpers as h
from pyspark.sql import SparkSession

args = parse_args()
spark = SparkSession.builder.getOrCreate()
spec = load_spec(args.bundle_root, args.use_case)
cat, sch = args.catalog, args.schema
ts = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

conv = spark.table(fq(cat, sch, "assessment_conversion")).orderBy("step_id").collect()
write_table(spark, [(r.step_id, r.step_name, r.construct, r.status, r.notes, r.executed_from, ts) for r in conv],
            "step_id INT, step_name STRING, construct STRING, status STRING, notes STRING, executed_from STRING, assessed_at TIMESTAMP",
            cat, sch, "assessment_statements")

summary, counts = h.summarize([r.status for r in conv])
tests = spark.table(fq(cat, sch, "assessment_test_results")).collect()
passed = sum(1 for t in tests if t.passed)
write_table(spark, [(spec["name"], summary["total_statements"], summary["clean_count"], summary["warning_count"],
                     summary["manual_count"], summary["automated_coverage_pct"], summary["remediation_count"],
                     passed, len(tests) - passed, ts)],
            "use_case STRING, total_statements INT, clean_count INT, warning_count INT, manual_count INT, "
            "automated_coverage_pct DOUBLE, remediation_count INT, tests_passed INT, tests_failed INT, assessed_at TIMESTAMP",
            cat, sch, "assessment_summary")

eff = h.effort_model(counts, spec["effort"])
write_table(spark, [(spec["name"], e["role"], e["clean_hours"], e["warning_hours"], e["manual_hours"], e["fixed_hours"],
                     e["total_hours"], e["assumption"]) for e in eff],
            "use_case STRING, role STRING, clean_hours DOUBLE, warning_hours DOUBLE, manual_hours DOUBLE, fixed_hours DOUBLE, "
            "total_hours DOUBLE, assumption STRING", cat, sch, "assessment_effort")

# Equivalent of the legacy TRY/CATCH logging: record the outcome of this run.
spark.sql(f"CREATE TABLE IF NOT EXISTS {fq(cat, sch, 'etl_log')} (run_at TIMESTAMP, step_name STRING, rows_loaded INT, message STRING)")
msg = "completed" if passed == len(tests) else f"{len(tests) - passed} checks failed"
spark.sql(f"INSERT INTO {fq(cat, sch, 'etl_log')} VALUES (current_timestamp(), 'legacy_conversion_assessment', {len(conv)}, '{msg}')")
print(summary, f"tests passed={passed} failed={len(tests) - passed}", sep="\n")
for e in eff:
    print(e["role"], e["total_hours"])
