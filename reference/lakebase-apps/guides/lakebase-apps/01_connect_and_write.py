# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Connect and write
# MAGIC
# MAGIC Safe to rerun. This notebook connects to the Lakebase project's production branch with an OAuth token minted for the identity that runs the job, creates an app schema and an `orders` table, and writes and reads rows.
# MAGIC
# MAGIC Three things to notice:
# MAGIC
# MAGIC - **A token per connection.** Lakebase OAuth tokens last one hour, and Postgres checks the token only when a connection opens. The pool calls `generate_database_credential` each time it opens a connection, so it never holds a stale token.
# MAGIC - **A retry around the first connection.** The compute scales to zero after five idle minutes. The first connection after that waits for it to resume, and a pooled connection that died during the suspension is replaced on checkout.
# MAGIC - **Statements that repeat safely.** `IF NOT EXISTS` on the schema and table, and `INSERT ... ON CONFLICT DO UPDATE` for the rows, so a second run ends in the same state.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
import lakebase_lib as lb

params = load_params(dbutils, "capability_guides_lakebase_apps", ['lakebase_project', 'app_schema'], defaults={'app_schema': 'lakebase_apps'})
w = WorkspaceClient()
endpoint = lb.endpoint_name(params["lakebase_project"], lb.BRANCH, lb.ENDPOINT)
user = w.current_user.me().user_name  # the Postgres role for this identity has the same name
app_schema = lb.ident(params["app_schema"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Open the pool and wait for the first connection
# MAGIC
# MAGIC `make_pool` builds a psycopg `ConnectionPool` with a connection class that fetches a new token for every physical connection. `connect_with_retry` waits for the first connection and backs off while the compute resumes.

# COMMAND ----------

started = time.monotonic()
pool = lb.make_pool(w, endpoint, user)
lb.connect_with_retry(pool)
print(f"First connection after {time.monotonic() - started:.1f}s")

# Show the token timing the pool relies on: a token is good for an hour, and a pool that holds one
# connection open past that still works, because expiry is checked at login only.
issued = time.time()
print(f"A token minted now needs a refresh in {lb.seconds_until_refresh(issued, issued) / 60:.0f} minutes if code reuses it.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the schema and table, then write rows
# MAGIC
# MAGIC `REPLICA IDENTITY FULL` is what Change Data Feed needs in notebook 3. Setting it twice changes nothing.

# COMMAND ----------

with pool.connection() as conn:
    for statement in lb.app_schema_sql(app_schema):
        conn.execute(statement)
    with conn.cursor() as cur:
        cur.executemany(lb.upsert_orders_sql(app_schema), lb.SAMPLE_ORDERS)
    print(f"Upserted {len(lb.SAMPLE_ORDERS)} orders into {app_schema}.orders")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the rows back

# COMMAND ----------

with pool.connection() as conn:
    who = conn.execute("SELECT current_user, current_database(), split_part(version(), ' ', 2)").fetchone()
    rows = conn.execute(f"SELECT order_id, customer, status, amount FROM {app_schema}.orders ORDER BY order_id").fetchall()
print(f"Connected as {who[0]} to {who[1]} (Postgres {who[2]})")
display(spark.createDataFrame([(r[0], r[1], r[2], float(r[3])) for r in rows], "order_id INT, customer STRING, status STRING, amount DOUBLE"))
assert len(rows) >= len(lb.SAMPLE_ORDERS), "expected the sample orders"

pool.close()
