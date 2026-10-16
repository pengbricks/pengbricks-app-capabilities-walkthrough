# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. SQL connector check
# MAGIC
# MAGIC Connects with the Databricks SQL connector and queries a governed table. With `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET` set, `Config()` performs OAuth M2M, as it would on a laptop. Here it uses the notebook's own identity.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_local_connectivity", ['catalog', 'schema', 'use_case', 'warehouse_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Connect and query

# COMMAND ----------

import time
from databricks import sql
from databricks.sdk.core import Config

cfg = Config()
auth_mode = "oauth-m2m" if os.environ.get("DATABRICKS_CLIENT_ID") else "job-identity"
host = cfg.host.replace("https://", "").rstrip("/")
http_path = f"/sql/1.0/warehouses/{params['warehouse_id']}"

start = time.perf_counter()
with sql.connect(server_hostname=host, http_path=http_path, credentials_provider=lambda: cfg.authenticate) as conn:
    with conn.cursor() as cursor:
        cursor.execute("SELECT current_user() AS who, current_catalog() AS cat")
        who, _ = cursor.fetchone()
        cursor.execute(
            f"SELECT region, COUNT(*) AS customers FROM {fq}.analyst_customers GROUP BY region ORDER BY region"
        )
        rows = cursor.fetchall()
seconds = round(time.perf_counter() - start, 2)
total = sum(int(r[1]) for r in rows)
print(f"Connected as {who} using {auth_mode}; {len(rows)} regions, {total} customers in {seconds}s")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the result
# MAGIC
# MAGIC Overwrites `connectivity_check`, so it always holds the latest check.

# COMMAND ----------

spark.createDataFrame(
    [(auth_mode, who, f"{fq}.analyst_customers", total, len(rows), seconds, params["run_id"])],
    "auth_mode STRING, connected_as STRING, table_name STRING, rows_counted BIGINT, groups_returned INT, seconds DOUBLE, run_id STRING",
).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{fq}.connectivity_check")
if total == 0:
    raise Exception("The connector returned no rows")
display(spark.table(f"{fq}.connectivity_check"))
