# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Generate load
# MAGIC
# MAGIC Fires many heavy statements at once so the single-cluster test warehouse has to queue, and waits until they finish. The statement ids are saved to `capacity_load_statements`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_compute_capacity", ['catalog', 'schema', 'warehouse_id', 'queries', 'range_rows'])

# COMMAND ----------

import datetime as dt
from types import SimpleNamespace
from common import run_sql_rows, workspace_id, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import grant_sql, principal_kind, qualified
import concurrent.futures as futures
import time
from governance_lib.analysis import max_concurrency, percentile

args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    warehouse_id=params["warehouse_id"],
    queries=params["queries"],
    range_rows=params["range_rows"],
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

TEST_WAREHOUSE = "capability-guides-capacity-test"

SETTINGS_DDL = ("warehouse_id string, name string, size string, min_clusters int, max_clusters int, auto_stop_minutes int, "
                "warehouse_type string, serverless boolean, channel string, spot_policy string, state string, role string")

LOAD_TAG = "capability_guides_load"

def _test_warehouse_id(args, spark) -> str:
    return run_sql_rows(spark, f"SELECT warehouse_id FROM {qualified(args.catalog, args.schema, 'capacity_test_warehouse')}")[0]["warehouse_id"]

def generate_load(args, spark) -> None:
    """Fire many heavy statements at once so the single-cluster warehouse has to queue."""
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.sql import ExecuteStatementRequestOnWaitTimeout, StatementState

    w = WorkspaceClient()
    warehouse_id = _test_warehouse_id(args, spark)
    count = int(args.queries)
    statement = (
        "/* " + LOAD_TAG + " */ SELECT g, count(*) AS n, sum(len(h)) AS total FROM ("
        "SELECT id % 997 AS g, sha2(cast(id AS STRING), 256) AS h FROM range(0, " + args.range_rows + ")) GROUP BY g"
    )

    def submit(_: int) -> str:
        response = w.statement_execution.execute_statement(
            statement=statement, warehouse_id=warehouse_id, wait_timeout="0s",
            on_wait_timeout=ExecuteStatementRequestOnWaitTimeout.CONTINUE)
        return response.statement_id

    with futures.ThreadPoolExecutor(max_workers=count) as pool:
        ids = list(pool.map(submit, range(count)))
    print(f"submitted {count} concurrent statements")

    deadline = time.time() + 1500
    pending = set(ids)
    final: dict[str, str] = {}
    while pending and time.time() < deadline:
        for statement_id in list(pending):
            state = w.statement_execution.get_statement(statement_id).status.state
            if state in (StatementState.SUCCEEDED, StatementState.FAILED, StatementState.CANCELED, StatementState.CLOSED):
                final[statement_id] = state.value
                pending.discard(statement_id)
        time.sleep(5)
    assert not pending, f"{len(pending)} statements did not finish"
    failed = {s: v for s, v in final.items() if v != "SUCCEEDED"}
    assert not failed, failed
    spark.createDataFrame([(s,) for s in ids], "statement_id string").write.mode("overwrite").saveAsTable(
        qualified(args.catalog, args.schema, "capacity_load_statements"))
    print(f"{len(ids)} statements succeeded")

# COMMAND ----------

generate_load(args, spark)
