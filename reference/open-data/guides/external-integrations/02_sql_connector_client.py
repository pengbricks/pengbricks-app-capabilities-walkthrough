# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. SQL Connector client
# MAGIC
# MAGIC A BI tool or custom app queries a SQL warehouse through the Databricks SQL Connector for Python. Power BI, Tableau, and custom apps reach a warehouse over the same HTTP path and OAuth identity. This notebook does it the way a custom app would, as the notebook's own identity.
# MAGIC
# MAGIC To use the app pattern instead, fill the optional `client_id` and `client_secret` widgets with an OAuth M2M service principal. Safe to rerun: the pattern's rows in `integration_checks` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from open_data.checks import append_rows, check_row
from open_data.connector import http_path
params = load_params(dbutils, "capability_guides_external_integrations", ['catalog', 'schema', 'use_case', 'warehouse_id'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"
import time
from importlib.metadata import version
from databricks import sql
from databricks.sdk.core import Config, oauth_service_principal

dbutils.widgets.text("client_id", "")
dbutils.widgets.text("client_secret", "")
client_id, client_secret = dbutils.widgets.get("client_id").strip(), dbutils.widgets.get("client_secret").strip()
warehouse_id = params["warehouse_id"]

COLUMNS = ["guide", "pattern", "check", "status", "value", "detail", "recorded_at"]
rows = []


def record(check, status, value, detail):
    rows.append(check_row("external-integrations", check, status, detail, value=value, pattern="sql-connector"))
    print(f"[{status}] {check}: {detail}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Choose the identity and connect settings

# COMMAND ----------

if client_id and client_secret:
    cfg = Config(client_id=client_id, client_secret=client_secret)
    provider = lambda: oauth_service_principal(cfg)  # noqa: E731
    identity = "OAuth M2M service principal"
else:
    cfg = Config()
    provider = lambda: cfg.authenticate  # noqa: E731
    identity = f"notebook identity ({cfg.auth_type})"
host = cfg.host.replace("https://", "").rstrip("/")
path = http_path(warehouse_id)
record("connection_settings", "INFO", path, f"databricks-sql-connector {version('databricks-sql-connector')}; host {host}; http_path {path}; identity {identity}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Query the warehouse

# COMMAND ----------

orders = f"{prefix}.sharing_orders"
started = time.time()
with sql.connect(server_hostname=host, http_path=path, credentials_provider=provider) as connection:
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT region, count(*) AS orders, round(sum(amount), 2) AS revenue FROM {orders} GROUP BY region ORDER BY region")
        summary = {r[0]: (int(r[1]), float(r[2])) for r in cursor.fetchall()}
        cursor.execute(f"SELECT count(*) FROM {orders} WHERE region = :region", {"region": "West"})
        west = int(cursor.fetchone()[0])
elapsed = time.time() - started

# COMMAND ----------

# MAGIC %md
# MAGIC ## Cross-check against Spark

# COMMAND ----------

expected = {r["region"]: (int(r["orders"]), float(r["revenue"])) for r in spark.sql(f"SELECT region, count(*) AS orders, round(sum(amount), 2) AS revenue FROM {orders} GROUP BY region").collect()}
record("aggregate_matches_spark", "PASS" if summary == expected else "FAIL", str(sum(v[0] for v in summary.values())), f"Warehouse returned {len(summary)} regions, {sum(v[0] for v in summary.values())} orders; matches the Spark result: {summary == expected}")
record("parameterized_query", "PASS" if west == expected["West"][0] else "FAIL", str(west), f"Named-parameter query (region = :region) returned {west} West orders; expected {expected['West'][0]}")
record("round_trip", "INFO", f"{elapsed:.1f}s", f"Connect, two statements, and fetch took {elapsed:.1f}s on a serverless SQL warehouse")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the checks

# COMMAND ----------

append_rows(spark, f"{prefix}.integration_checks", rows, COLUMNS, replace_where="pattern = 'sql-connector'")
failed = [r["check"] for r in rows if r["status"] == "FAIL"]
if failed:
    raise Exception(f"Failed checks: {failed}")
display(spark.table(f"{prefix}.integration_checks").where("pattern = 'sql-connector'"))
