# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Read through the Iceberg REST catalog
# MAGIC
# MAGIC PyIceberg gets the catalog URI, a bearer token for the current identity, and asks for vended credentials so it can read the data files. Without the vended-credentials header the data read is denied. Safe to rerun: its rows in `iceberg_checks` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from open_data.checks import append_rows, check_row
from open_data.iceberg import catalog_properties, require_external_access
from open_data.spec import load_spec
params = load_params(dbutils, "capability_guides_iceberg", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"
from databricks.sdk import WorkspaceClient
from pyiceberg.catalog import load_catalog
from pyiceberg.expressions import EqualTo

COLUMNS = ["guide", "check", "status", "value", "detail", "recorded_at"]
cfg = load_spec(SPEC_FILE)["iceberg"]
rows = []


def record(check, status, value, detail):
    rows.append(check_row("iceberg-support", check, status, detail, value=value))
    print(f"[{status}] {check}: {detail}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configure PyIceberg

# COMMAND ----------

w = require_external_access(WorkspaceClient(), catalog, schema)
token = w.config.authenticate()["Authorization"].split(" ", 1)[1]
props = catalog_properties(w.config.host, catalog, cfg["irc_path"], token)
shown = {k: ("***" if k == "token" else v) for k, v in props.items()}
record("irc_configuration", "INFO", props["uri"], f"PyIceberg properties: {shown}")
iceberg_catalog = load_catalog("unity", **props)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the schema and the data

# COMMAND ----------

identifier = f"{schema}.{cfg['table']}"
table = iceberg_catalog.load_table(identifier)
fields = [f.name for f in table.schema().fields]
added = cfg["added_column"]["name"]
record("external_schema", "PASS" if added in fields else "FAIL", str(len(fields)), f"{identifier} through the REST catalog has {len(fields)} columns, including {added}: {added in fields}")

arrow = table.scan().to_arrow()
spark_count = spark.table(f"{prefix}.{cfg['table']}").count()
record("external_read", "PASS" if arrow.num_rows == spark_count else "FAIL", str(arrow.num_rows), f"PyIceberg read {arrow.num_rows} rows; Spark reads {spark_count}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Push a filter down and list snapshots

# COMMAND ----------

west = table.scan(row_filter=EqualTo("region", "West")).to_arrow()
record("external_filter_pushdown", "PASS" if west.num_rows > 0 else "FAIL", str(west.num_rows), f"Filter region = 'West' in PyIceberg returned {west.num_rows} rows")

snapshots = table.snapshots()
record("external_snapshots", "INFO", str(len(snapshots)), f"Iceberg metadata lists {len(snapshots)} snapshot(s); current snapshot {table.current_snapshot().snapshot_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the checks

# COMMAND ----------

append_rows(spark, f"{prefix}.iceberg_checks", rows, COLUMNS, replace_where="`check` IN ('irc_configuration', 'external_schema', 'external_read', 'external_filter_pushdown', 'external_snapshots')")
failed = [r["check"] for r in rows if r["status"] == "FAIL"]
if failed:
    raise Exception(f"Failed checks: {failed}")
display(spark.table(f"{prefix}.iceberg_checks"))
