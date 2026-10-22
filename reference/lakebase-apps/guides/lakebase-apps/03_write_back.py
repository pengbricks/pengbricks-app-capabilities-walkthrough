# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Write back to Delta with Change Data Feed
# MAGIC
# MAGIC Safe to rerun. **Lakebase Change Data Feed (Public Preview)** records every insert, update, and delete on the tables of a Postgres schema as rows in a Unity Catalog managed Delta table named `lb_<table>_history`. Changes arrive in batches about every 15 seconds. The feed is set up per schema, and each table needs `REPLICA IDENTITY FULL`.
# MAGIC
# MAGIC A workspace admin must turn the preview on from the Previews page. When it is off, or the destination catalog uses default storage, this notebook explains what it hit and ends without failing, so the rest of the job still runs.
# MAGIC
# MAGIC What a rerun does:
# MAGIC
# MAGIC 1. Puts the sample orders back to their starting values (an upsert).
# MAGIC 2. Reuses the feed if the schema already has one. A schema can have only one feed, so enabling it again does nothing.
# MAGIC 3. Updates one order and deletes another, then waits until the history table shows the new events.
# MAGIC
# MAGIC The history table is append-only, so it grows by a few rows each run. The orders table ends in the same state every time.
# MAGIC
# MAGIC Change types in the history table: `insert`, `update_preimage` (the row before an update), `update_postimage` (the row after), and `delete`.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import DatabricksError
from databricks.sdk.service.postgres import CdfConfig
import lakebase_lib as lb

params = load_params(dbutils, "capability_guides_lakebase_apps", ['catalog', 'schema', 'lakebase_project', 'app_schema'], defaults={'app_schema': 'lakebase_apps'})
w = WorkspaceClient()
catalog, schema = params["catalog"], lb.ident(params["schema"])
project, app_schema = params["lakebase_project"], lb.ident(params["app_schema"])
branch = lb.branch_name(project, lb.BRANCH)
user = w.current_user.me().user_name
history = f"{catalog}.{schema}.lb_orders_history"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Reset the sample orders

# COMMAND ----------

pool = lb.make_pool(w, lb.endpoint_name(project, lb.BRANCH, lb.ENDPOINT), user)
lb.connect_with_retry(pool)
with pool.connection() as conn:
    for statement in lb.app_schema_sql(app_schema):
        conn.execute(statement)
    with conn.cursor() as cur:
        cur.executemany(lb.upsert_orders_sql(app_schema), lb.SAMPLE_ORDERS)
print("Orders reset to their starting values")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Start the feed, or reuse it
# MAGIC
# MAGIC The feed is a CDF configuration on the database. It maps the Postgres schema to a Unity Catalog catalog and schema. It cannot be edited after creation.

# COMMAND ----------

database_path = lb.find_database_path(w, branch, lb.DATABASE)
configs = [{"postgres_schema": c.postgres_schema, "name": c.name, "catalog": c.catalog, "schema": c.schema}
           for c in w.postgres.list_cdf_configs(parent=database_path)]
action = lb.cdf_action(configs, app_schema)
print(f"CDF configurations on {lb.DATABASE}: {len(configs)} -> {action}")

if action == "create":
    try:
        w.postgres.create_cdf_config(
            parent=database_path,
            cdf_config=CdfConfig(catalog=catalog, schema=schema, postgres_schema=app_schema),
            cdf_config_id=app_schema,
        ).wait()
        print(f"Started the feed: {app_schema} -> {catalog}.{schema}")
    except DatabricksError as error:
        message = (
            "Lakebase Change Data Feed could not be started, so this notebook stops here and the job continues.\n"
            f"  Error: {type(error).__name__}: {str(error)[:300]}\n"
            "  Common causes:\n"
            "  - The Public Preview is off. A workspace admin turns it on from the Previews page.\n"
            "  - The destination catalog uses default storage. Use a catalog with a managed storage location.\n"
            "  - The identity lacks CAN MANAGE on the project, or USE CATALOG, USE SCHEMA, and permission to create tables on the destination.\n"
            "  To start it by hand: Lakebase app > project > branch overview > Lakebase CDF tab > Start."
        )
        print(message)
        pool.close()
        dbutils.notebook.exit("skipped: " + str(error)[:200])
else:
    existing = next(c for c in configs if c["postgres_schema"] == app_schema)
    print(f"Reusing the feed {existing['name'].rsplit('/', 1)[-1]} -> {existing['catalog']}.{existing['schema']}")
    history = f"{existing['catalog']}.{existing['schema']}.lb_orders_history"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Wait for the initial snapshot
# MAGIC
# MAGIC The first load writes every existing row as an `insert`. A table appears in the destination only when it has data, which is why notebook 1 wrote rows first.

# COMMAND ----------

def snapshot_rows():
    try:
        return spark.sql(f"SELECT count(DISTINCT order_id) FROM {history} WHERE _pg_change_type = 'insert'").first()[0]
    except Exception as error:  # the table does not exist until the snapshot lands
        return 0

lb.wait_until(snapshot_rows, lambda n: n >= len(lb.SAMPLE_ORDERS), timeout=900, interval=15, what="the initial snapshot")
statuses = [(s.postgres_table, s.state.value if s.state else None) for s in w.postgres.list_cdf_statuses(parent=f"{database_path}/cdf-configs/{app_schema}")]
print("Per-table feed state:", statuses)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Let the reset settle, then count the events so far
# MAGIC
# MAGIC Step 1 may itself have produced update events. The count is read until it stops changing, so the next step measures only its own changes.

# COMMAND ----------

ids = (lb.UPDATED_ORDER_ID, lb.DELETED_ORDER_ID)

def counts():
    rows = spark.sql(
        f"SELECT _pg_change_type, count(*) FROM {history} WHERE order_id IN {ids} GROUP BY _pg_change_type"
    ).collect()
    return lb.cdf_counts([(r[0], r[1]) for r in rows])

readings = []
while not lb.is_stable(readings):
    readings.append(counts())
    time.sleep(10)
    if len(readings) > 30:
        break
before = readings[-1]
print("Events for the two orders before the change:", before)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Update one order and delete another

# COMMAND ----------

with pool.connection() as conn:
    conn.execute(f"UPDATE {app_schema}.orders SET status = 'shipped', updated_at = now() WHERE order_id = %s", (lb.UPDATED_ORDER_ID,))
with pool.connection() as conn:
    conn.execute(f"DELETE FROM {app_schema}.orders WHERE order_id = %s", (lb.DELETED_ORDER_ID,))
print(f"Updated order {lb.UPDATED_ORDER_ID} and deleted order {lb.DELETED_ORDER_ID}")
pool.close()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the Delta history table
# MAGIC
# MAGIC The update adds an `update_preimage` and an `update_postimage` row. The delete adds a `delete` row. The wait ends when each of the three change types has grown.

# COMMAND ----------

def missing():
    return lb.cdf_missing_changes(before, counts())

lb.wait_until(missing, lambda gone: gone == [], timeout=600, interval=10, what="the change events")
display(spark.sql(f"""
    SELECT order_id, _pg_change_type, customer, status, amount, _timestamp
    FROM {history}
    WHERE order_id IN {ids}
    ORDER BY _sort_by DESC
    LIMIT 12
"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Current state from the history
# MAGIC
# MAGIC The latest version of each order that is not deleted. The `update_preimage` rows hold old values, so the query leaves them out.

# COMMAND ----------

display(spark.sql(f"""
    SELECT order_id, customer, status, amount FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY _sort_by DESC) AS rn
        FROM {history} WHERE _pg_change_type <> 'update_preimage'
    ) WHERE rn = 1 AND _pg_change_type <> 'delete' ORDER BY order_id
"""))
