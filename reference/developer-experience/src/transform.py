"""Generates sample data from the use-case spec, applies dx_demo, and writes a Delta table.

Args: <bundle files root> <catalog> <schema> <use_case> <output_table>
"""
import sys

sys.dont_write_bytecode = True

from pathlib import Path  # noqa: E402

root = Path(sys.argv[1])
catalog, schema, use_case, expected_table = sys.argv[2:6]
sys.path.insert(0, str(root / "src"))

from pyspark.sql import SparkSession  # noqa: E402

from dx_demo.spec import (  # noqa: E402
    ddl_schema, expected_clean_count, generate_base_rows, generate_base_rows_dbldatagen,
    inject_edge_cases, load_spec,
)
from dx_demo.transforms import add_band, add_date, clean_records  # noqa: E402

spark = SparkSession.builder.getOrCreate()
spec = load_spec(root / "use_cases" / f"{use_case}.yml")
if spec["output_table"] != expected_table:
    raise SystemExit(f"bundle output_table '{expected_table}' does not match spec '{spec['output_table']}'")

try:
    base = generate_base_rows_dbldatagen(spark, spec)
    print("Generated base rows with dbldatagen")
except Exception as exc:  # fall back to the seeded pure-Python generator
    print(f"dbldatagen unavailable ({exc!r}); using the pure-Python generator")
    base = generate_base_rows(spec)

rows = inject_edge_cases(base, spec)
raw = spark.createDataFrame(rows, ddl_schema(spec))
print(f"Raw rows including injected edge cases: {raw.count()}")

key, value, ts = spec["key_column"], spec["value_column"], spec["timestamp_column"]
out = clean_records(raw, key, value, ts)
out = add_date(out, ts)
bands = spec.get("bands")
if bands:
    out = add_band(out, value, bands["column"], [(t["min"], t["label"]) for t in bands["thresholds"]], bands["default"])

spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{catalog}`.`{schema}`")
target = f"`{catalog}`.`{schema}`.`{spec['output_table']}`"
out.write.mode("overwrite").saveAsTable(target)

n, want = spark.table(target).count(), expected_clean_count(spec)
print(f"Wrote {n} rows to {target}; spec expects {want}")
if n != want:
    raise SystemExit(f"row count {n} != expected {want}")
