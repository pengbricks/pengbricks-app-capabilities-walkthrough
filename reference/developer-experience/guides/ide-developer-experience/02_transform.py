# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Transform
# MAGIC
# MAGIC Generates sample data from the use-case spec, injects the edge cases the spec lists, applies the `dx_demo` transforms, and writes a Delta table. Safe to rerun: the write overwrites the table, so a rerun replaces it.

# COMMAND ----------

import sys, os
sys.dont_write_bytecode = True  # workspace files cannot hold __pycache__
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_developer_experience_workflow", ['catalog', 'schema', 'use_case', 'output_table', 'key_column', 'value_column'])
ROOT = bundle_root()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Load the spec
# MAGIC
# MAGIC All domain names (columns, table, thresholds) come from `use_cases/<use_case>.yml`. The code is generic.

# COMMAND ----------

sys.path.insert(0, str(ROOT / "src"))
from dx_demo.spec import (
    ddl_schema, expected_clean_count, generate_base_rows, generate_base_rows_spark,
    inject_edge_cases, load_spec,
)
from dx_demo.transforms import add_band, add_date, clean_records

spec = load_spec(ROOT / "use_cases" / f"{params['use_case']}.yml")
if spec["output_table"] != params["output_table"]:
    raise Exception(f"output_table '{params['output_table']}' does not match spec '{spec['output_table']}'")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Generate sample rows and inject edge cases
# MAGIC
# MAGIC The sample-data generator (`src/sample_data.py`) builds the base rows with a fixed seed. If Spark generation fails, a seeded pure-Python generator gives the same shape. The edge cases (null and blank keys, negatives, duplicates) are added deterministically.

# COMMAND ----------

try:
    base = generate_base_rows_spark(spark, spec)
    print("Generated base rows with the sample-data generator")
except Exception as exc:  # fall back to the seeded pure-Python generator
    print(f"Spark generation failed ({exc!r}); using the pure-Python generator")
    base = generate_base_rows(spec)

rows = inject_edge_cases(base, spec)
raw = spark.createDataFrame(rows, ddl_schema(spec))
print(f"Raw rows including injected edge cases: {raw.count()}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Apply the transforms

# COMMAND ----------

key, value, ts = spec["key_column"], spec["value_column"], spec["timestamp_column"]
out = clean_records(raw, key, value, ts)
out = add_date(out, ts)
bands = spec.get("bands")
if bands:
    out = add_band(out, value, bands["column"], [(t["min"], t["label"]) for t in bands["thresholds"]], bands["default"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the table and check the row count
# MAGIC
# MAGIC The schema is owned by the foundation bundle. This guide only writes its table into it.

# COMMAND ----------

target = f"`{params['catalog']}`.`{params['schema']}`.`{spec['output_table']}`"
out.write.mode("overwrite").saveAsTable(target)

n, want = spark.table(target).count(), expected_clean_count(spec)
print(f"Wrote {n} rows to {target}; spec expects {want}")
if n != want:
    raise Exception(f"row count {n} != expected {want}")
display(spark.table(target).limit(10))
