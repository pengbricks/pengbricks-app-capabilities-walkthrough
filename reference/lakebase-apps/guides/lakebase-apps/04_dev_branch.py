# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. A dev branch with an expiration
# MAGIC
# MAGIC Safe to rerun. A branch is a copy-on-write child of its parent. It shares storage with production until you change something, so it exists in seconds at any database size and costs only the data that differs. Changes on a branch never reach its parent.
# MAGIC
# MAGIC This notebook:
# MAGIC
# MAGIC 1. Deletes a leftover branch with the same ID, so a rerun starts from the current production data.
# MAGIC 2. Creates the branch from production with a one-hour expiration (`ttl`) and a compute that scales to zero after five idle minutes.
# MAGIC 3. Writes an order on the branch and checks that production does not have it.
# MAGIC 4. Deletes the branch. Set the `dev_branch_action` widget to `keep` to leave it until it expires.
# MAGIC
# MAGIC The branch API has no reset call in the SDK, so the notebook deletes and recreates. Reset from parent is also available in the Lakebase UI. A branch that has child branches cannot be deleted or reset.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.postgres import Branch, BranchSpec, Endpoint, EndpointSpec, EndpointType
from google.protobuf.duration_pb2 import Duration
import lakebase_lib as lb

params = load_params(dbutils, "capability_guides_lakebase_apps", ['lakebase_project', 'app_schema', 'dev_branch'], defaults={'app_schema': 'lakebase_apps', 'dev_branch': 'dev-demo'})
dbutils.widgets.text("dev_branch_action", "")
dev_action = (dbutils.widgets.get("dev_branch_action").strip() or "delete").lower()
w = WorkspaceClient()
project, app_schema = lb.require_project(w, params["lakebase_project"]), lb.ident(params["app_schema"])
production = lb.branch_name(project, lb.BRANCH)
dev = lb.branch_name(project, params["dev_branch"])
user = w.current_user.me().user_name
NEW_ORDER = 9001

# COMMAND ----------

# MAGIC %md
# MAGIC ## Make sure production has the orders table

# COMMAND ----------

prod_pool = lb.make_pool(w, lb.endpoint_name(project, lb.BRANCH, lb.ENDPOINT), user)
lb.connect_with_retry(prod_pool)
with prod_pool.connection() as conn:
    for statement in lb.app_schema_sql(app_schema):
        conn.execute(statement)
    with conn.cursor() as cur:
        cur.executemany(lb.upsert_orders_sql(app_schema), lb.SAMPLE_ORDERS)
    conn.execute(f"DELETE FROM {app_schema}.orders WHERE order_id = %s", (NEW_ORDER,))  # a leftover from an earlier run, if any

# COMMAND ----------

# MAGIC %md
# MAGIC ## Delete a leftover branch, then create it from production
# MAGIC
# MAGIC `lb.branch_action` returns `create` when the branch is missing and `recreate` when it exists.

# COMMAND ----------

def get_branch():
    try:
        return w.postgres.get_branch(name=dev)
    except NotFound:
        return None

def state_of(branch):
    return None if branch is None or branch.status is None or branch.status.current_state is None else branch.status.current_state.value

existing = get_branch()
action = lb.branch_action(state_of(existing))
print(f"Branch {params['dev_branch']}: {state_of(existing)} -> {action}")
if action == "recreate":
    for endpoint in w.postgres.list_endpoints(parent=dev):
        w.postgres.delete_endpoint(name=endpoint.name).wait()
    w.postgres.delete_branch(name=dev).wait()
    lb.wait_until(lambda: get_branch(), lambda b: b is None or state_of(b) == "DELETED", timeout=300, interval=5, what="the branch delete")

created = w.postgres.create_branch(
    parent=lb.project_name(project),
    branch=Branch(spec=BranchSpec(source_branch=production, ttl=Duration(seconds=3600))),
    branch_id=params["dev_branch"],
).wait()
print("Created", created.name, "| expires", created.status.expire_time)

# A branch starts without compute. Add a read-write endpoint that suspends after five idle minutes.
endpoints = list(w.postgres.list_endpoints(parent=dev))
if not endpoints:
    w.postgres.create_endpoint(
        parent=dev,
        endpoint=Endpoint(spec=EndpointSpec(
            endpoint_type=EndpointType.ENDPOINT_TYPE_READ_WRITE,
            autoscaling_limit_min_cu=0.5,
            autoscaling_limit_max_cu=2,
            suspend_timeout_duration=Duration(seconds=300),
        )),
        endpoint_id=lb.ENDPOINT,
    ).wait()
dev_endpoint = lb.endpoint_name(project, params["dev_branch"], lb.ENDPOINT)
print("Dev endpoint:", dev_endpoint)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write on the branch, then look at production

# COMMAND ----------

dev_pool = lb.make_pool(w, dev_endpoint, user)
lb.connect_with_retry(dev_pool)
with dev_pool.connection() as conn:
    inherited = conn.execute(f"SELECT count(*) FROM {app_schema}.orders").fetchone()[0]
    conn.execute(lb.upsert_orders_sql(app_schema), (NEW_ORDER, "Dev branch customer", "new", 1.00))
    on_dev = conn.execute(f"SELECT count(*) FROM {app_schema}.orders WHERE order_id = %s", (NEW_ORDER,)).fetchone()[0]
with prod_pool.connection() as conn:
    on_prod = conn.execute(f"SELECT count(*) FROM {app_schema}.orders WHERE order_id = %s", (NEW_ORDER,)).fetchone()[0]

print(f"The branch started with {inherited} orders copied from production")
print(f"Order {NEW_ORDER} on the dev branch: {on_dev}")
print(f"Order {NEW_ORDER} on production:     {on_prod}")
assert on_dev == 1 and on_prod == 0, "the branch is not isolated"
dev_pool.close()
prod_pool.close()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Delete the branch
# MAGIC
# MAGIC Expiring branches delete themselves, so this step only saves the wait. Deleting a branch deletes its compute too.

# COMMAND ----------

if dev_action == "keep":
    print(f"Keeping {params['dev_branch']} until it expires:", w.postgres.get_branch(name=dev).status.expire_time)
else:
    w.postgres.delete_branch(name=dev).wait()
    lb.wait_until(lambda: get_branch(), lambda b: b is None or state_of(b) == "DELETED", timeout=300, interval=5, what="the branch delete")
    print("Deleted", dev)
