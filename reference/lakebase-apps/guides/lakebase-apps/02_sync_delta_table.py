# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Sync a Delta table into Lakebase
# MAGIC
# MAGIC Safe to rerun. A synced table copies a Unity Catalog Delta table into Lakebase and keeps it updated with a managed pipeline (reverse ETL). Synced tables are generally available. This notebook uses **Triggered** mode: each run of the pipeline applies the changes since the last one. Snapshot and Continuous are the other modes.
# MAGIC
# MAGIC Steps:
# MAGIC
# MAGIC 1. Create the Delta source `lakebase_products` in the shared schema. It has a primary key and a change feed, which Triggered mode needs. A rerun refills it with `INSERT OVERWRITE`, so the row count stays at five.
# MAGIC 2. Look for the synced table. If it is missing, create it. If its pipeline failed, delete it and create it again. If it is online, start a new update.
# MAGIC 3. Wait until the Postgres copy matches the source, then read it from Postgres.
# MAGIC
# MAGIC The Unity Catalog schema name becomes the Postgres schema name, and the synced table is read-only in Postgres.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound, DatabricksError
from databricks.sdk.service.postgres import (
    NewPipelineSpec,
    SyncedTable,
    SyncedTableSyncedTableSpec,
    SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy as Policy,
)
import lakebase_lib as lb

params = load_params(dbutils, "capability_guides_lakebase_apps", ['catalog', 'schema', 'lakebase_project'])
w = WorkspaceClient()
catalog, schema = params["catalog"], lb.ident(params["schema"])
project = lb.require_project(w, params["lakebase_project"])
branch = lb.branch_name(project, lb.BRANCH)
source = f"{catalog}.{schema}.lakebase_products"
synced = f"{catalog}.{schema}.lakebase_products_synced"
user = w.current_user.me().user_name

# COMMAND ----------

# MAGIC %md
# MAGIC ## The Delta source table

# COMMAND ----------

for statement in lb.delta_source_sql(source):
    spark.sql(statement)
values = ", ".join(f"({i}, '{n}', '{c}', {p}, {s})" for i, n, c, p, s in lb.SAMPLE_PRODUCTS)
spark.sql(f"INSERT OVERWRITE {source} VALUES {values}")
expected = spark.sql(f"SELECT count(*) AS n, sum(stock) AS stock FROM {source}").first()
print(f"{source}: {expected.n} rows, stock {expected.stock}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the synced table, or reuse it
# MAGIC
# MAGIC The choice is made by `synced_table_action`: `create` when missing, `recreate` when the pipeline failed, `reuse` when it is online, `wait` while it provisions.

# COMMAND ----------

def current_table():
    try:
        return w.postgres.get_synced_table(name=f"synced_tables/{synced}")
    except NotFound:
        return None

def state_of(table):
    if table is None:
        return None
    return table.status.detailed_state.value if table.status and table.status.detailed_state else "UNKNOWN"

table = current_table()
action = lb.synced_table_action(state_of(table))
print(f"Synced table state: {state_of(table)} -> {action}")

if action == "recreate":
    w.postgres.delete_synced_table(name=f"synced_tables/{synced}").wait()
    action = "create"

if action == "create":
    table = w.postgres.create_synced_table(
        synced_table=SyncedTable(
            spec=SyncedTableSyncedTableSpec(
                source_table_full_name=source,
                branch=branch,
                primary_key_columns=["product_id"],
                scheduling_policy=Policy.TRIGGERED,
                postgres_database=lb.DATABASE,
                create_database_objects_if_missing=True,
                new_pipeline_spec=NewPipelineSpec(storage_catalog=catalog, storage_schema=schema),
            )
        ),
        synced_table_id=synced,
    ).wait()
    print("Created", synced)
elif action == "reuse":
    # The source was just overwritten. Triggered mode copies the change when its pipeline runs.
    pipeline_id = table.status.pipeline_id
    try:
        w.pipelines.start_update(pipeline_id=pipeline_id)
        print("Started a pipeline update:", pipeline_id)
    except DatabricksError as error:
        print("An update is already running or starting:", str(error)[:120])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Wait for the sync, then read the copy from Postgres
# MAGIC
# MAGIC The check compares the Postgres row count and stock total with the source, so it passes only when the copy is current.

# COMMAND ----------

pool = lb.make_pool(w, lb.endpoint_name(project, lb.BRANCH, lb.ENDPOINT), user)
lb.connect_with_retry(pool)
pg_table = f'"{schema}".lakebase_products_synced'

def postgres_totals():
    try:
        with pool.connection() as conn:
            return tuple(int(v or 0) for v in conn.execute(f"SELECT count(*), sum(stock) FROM {pg_table}").fetchone())
    except Exception as error:  # the table does not exist until the first sync finishes
        return ("waiting", str(error).splitlines()[0][:80])

totals = lb.wait_until(
    postgres_totals,
    lambda t: t == (expected.n, expected.stock),
    timeout=1500,
    interval=20,
    what="the synced table",
)
print(f"Postgres copy matches the source: {totals}")

with pool.connection() as conn:
    rows = conn.execute(f"SELECT product_id, name, category, price, stock FROM {pg_table} ORDER BY product_id").fetchall()
display(spark.createDataFrame([(r[0], r[1], r[2], float(r[3]), r[4]) for r in rows], "product_id INT, name STRING, category STRING, price DOUBLE, stock INT"))
final = current_table()
policy = getattr(getattr(final, "spec", None), "scheduling_policy", None)  # get() can omit spec
print("Sync state:", state_of(final), "| scheduling policy:", policy.value if policy else "TRIGGERED (as requested)")
pool.close()
