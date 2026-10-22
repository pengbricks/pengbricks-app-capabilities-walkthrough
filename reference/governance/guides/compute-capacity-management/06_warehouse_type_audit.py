# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Warehouse type audit
# MAGIC
# MAGIC Lists every SQL warehouse in the workspace with its type (classic, pro, or serverless), size, cluster range, auto-stop, and state. It flags warehouses that are not serverless, and auto-stop above the documented default, with the reason from the guide. The result goes to `governance_warehouse_types`. It reads warehouse settings and creates nothing.
# MAGIC
# MAGIC Safe to rerun: the table is replaced, and the notebook only reads warehouses.
# MAGIC
# MAGIC The API reports a serverless warehouse as `warehouse_type` `PRO` with `enable_serverless_compute` true. The SQL warehouses API defaults to classic, so a script that leaves both fields out creates a classic warehouse. Set both explicitly.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_compute_capacity", ['catalog', 'schema'])

# COMMAND ----------

import datetime as dt
import json
from types import SimpleNamespace
from common import write_rows
from governance_lib.sqlgen import qualified
from governance_lib.warehouses import audit_row, serverless_request_body

args = SimpleNamespace(catalog=params["catalog"], schema=params["schema"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

AUDIT_DDL = ("warehouse_id string, name string, warehouse_class string, size string, min_clusters int, max_clusters int, "
             "auto_stop_minutes int, auto_stop_default_minutes int, state string, is_serverless boolean, flagged boolean, "
             "flags string, audited_at timestamp")

def warehouse_type_audit(args, spark) -> list[dict]:
    """List every warehouse with its type and flag the ones that are not serverless or stop too late."""
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    rows = []
    for item in w.warehouses.list():
        wh = item if item.enable_serverless_compute is not None else w.warehouses.get(item.id)
        row = audit_row(
            wh.id, wh.name, wh.warehouse_type.value if wh.warehouse_type else None, wh.enable_serverless_compute,
            wh.cluster_size, wh.min_num_clusters, wh.max_num_clusters, wh.auto_stop_mins, wh.state.value if wh.state else None)
        rows.append({**row, "audited_at": now})
    write_rows(spark, args.catalog, args.schema, "governance_warehouse_types", rows, AUDIT_DDL)
    for row in rows:
        mark = "FLAG" if row["flagged"] else "ok  "
        print(f"{mark} {row['name']}: {row['warehouse_class']}, {row['size']}, {row['min_clusters']}-{row['max_clusters']} clusters, "
              f"auto-stop {row['auto_stop_minutes']} min, {row['state']}")
        if row["flags"]:
            print("     " + row["flags"].replace(" | ", "\n     "))
    print(f"{sum(r['flagged'] for r in rows)} of {len(rows)} warehouses flagged")
    return rows

def show_serverless_request() -> None:
    """Print the request that creates a serverless warehouse explicitly. Nothing is created here."""
    body = serverless_request_body("bi-serverless", size="Medium", min_clusters=1, max_clusters=4, auto_stop_minutes=10)
    print("POST /api/2.0/sql/warehouses  (printed, not sent)")
    print(json.dumps(body, indent=2))
    print("\nSDK equivalent:  w.warehouses.create(name=..., cluster_size=..., warehouse_type=CreateWarehouseRequestWarehouseType.PRO, "
          "enable_serverless_compute=True)")

# COMMAND ----------

warehouse_type_audit(args, spark)
show_serverless_request()
