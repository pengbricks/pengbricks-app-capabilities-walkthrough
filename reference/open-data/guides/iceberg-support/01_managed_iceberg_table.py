# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Managed Iceberg table
# MAGIC
# MAGIC Creates the table with `USING ICEBERG`, appends a second batch, adds a column, and reads an earlier version. The table is dropped and rebuilt on each run, so a rerun gives the same row counts.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from open_data.checks import append_rows, check_row
from open_data.spec import build_table, load_spec
params = load_params(dbutils, "capability_guides_iceberg", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

COLUMNS = ["guide", "check", "status", "value", "detail", "recorded_at"]
spec = load_spec(SPEC_FILE)
cfg = spec["iceberg"]
table = f"{prefix}.{cfg['table']}"
added = cfg["added_column"]
rows = []


def record(check, status, value, detail):
    rows.append(check_row("iceberg-support", check, status, detail, value=value))
    print(f"[{status}] {check}: {detail}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the table

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {table}")
seed = build_table(spark, spec, "sharing_orders", rows=int(cfg["seed_rows"]))
seed.createOrReplaceTempView("iceberg_seed")
spark.sql(f"CREATE TABLE {table} USING ICEBERG AS SELECT * FROM iceberg_seed")
provider = spark.sql(f"DESCRIBE EXTENDED {table}").filter("col_name = 'Provider'").first()
record("create_managed_iceberg", "PASS", str(spark.table(table).count()), f"{table} created with USING ICEBERG; provider {provider['data_type'] if provider else 'iceberg'}; {cfg['seed_rows']} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Append a second batch
# MAGIC
# MAGIC A different seed gives different rows.

# COMMAND ----------

build_table(spark, spec, "sharing_orders", rows=int(cfg["extra_rows"]), seed_offset=1).writeTo(table).append()
after_append = spark.table(table).count()
record("append", "PASS" if after_append == cfg["seed_rows"] + cfg["extra_rows"] else "FAIL", str(after_append), f"Appended {cfg['extra_rows']} rows; table has {after_append}")
v_before_evolve = max(r["version"] for r in spark.sql(f"DESCRIBE HISTORY {table}").collect())

# COMMAND ----------

# MAGIC %md
# MAGIC ## Evolve the schema
# MAGIC
# MAGIC Add a column, then backfill it.

# COMMAND ----------

spark.sql(f"ALTER TABLE {table} ADD COLUMN {added['name']} {added['type']}")
spark.sql(f"UPDATE {table} SET {added['name']} = '{added['default']}' WHERE {added['name']} IS NULL")
columns_now = [f.name for f in spark.table(table).schema.fields]
record("schema_evolution", "PASS" if added["name"] in columns_now else "FAIL", added["name"], f"Added column {added['name']} {added['type']}; table now has {len(columns_now)} columns, rows backfilled with '{added['default']}'")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Time travel
# MAGIC
# MAGIC The version before the `ALTER` has no new column and the pre-update rows.

# COMMAND ----------

old = spark.sql(f"SELECT * FROM {table} VERSION AS OF {v_before_evolve}")
old_columns = old.columns
ok = added["name"] not in old_columns and old.count() == after_append
record("time_travel", "PASS" if ok else "FAIL", str(v_before_evolve), f"VERSION AS OF {v_before_evolve}: {old.count()} rows, {len(old_columns)} columns (no {added['name']}); current table has {len(columns_now)}")
history = spark.sql(f"DESCRIBE HISTORY {table}").select("version", "operation").orderBy("version").collect()
record("history", "INFO", str(len(history)), "Versions: " + ", ".join(f"{h['version']}={h['operation']}" for h in history))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Allow external access
# MAGIC
# MAGIC External engines need `EXTERNAL USE SCHEMA` for the identity they use.

# COMMAND ----------

me = spark.sql("SELECT current_user()").first()[0]
spark.sql(f"GRANT EXTERNAL USE SCHEMA ON SCHEMA {prefix} TO `{me}`")
record("external_use_schema", "PASS", me, f"Granted EXTERNAL USE SCHEMA on {prefix} to the job identity")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the checks

# COMMAND ----------

append_rows(spark, f"{prefix}.iceberg_checks", rows, COLUMNS, replace_where="guide = 'iceberg-support'")
failed = [r["check"] for r in rows if r["status"] == "FAIL"]
if failed:
    raise Exception(f"Failed checks: {failed}")
display(spark.table(f"{prefix}.iceberg_checks"))
