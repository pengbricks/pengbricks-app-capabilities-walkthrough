# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Check the source and start the gateway
# MAGIC
# MAGIC Before any data moves, three things must hold. The Unity Catalog connection exists and names the host. The source tables have the change capture their SCD type needs: CDC on `customers` (history), Change Tracking on `orders` and `products`, and never both on one table. And the gateway is running, because it reads the change log continuously and the ingestion pipeline only applies what it staged.
# MAGIC
# MAGIC The job reads the source with the application login from the secret scope, not with the connector's `lakeflow_ingest` login, whose password lives only in the connection. Safe to rerun: it reads the source, starts the gateway only if it is idle, and replaces its rows in `lfc_results`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
JOB = "capability_guides_lakeflow_connect"
params = load_params(dbutils, JOB, ["catalog", "schema", "sqlserver_connection", "sqlserver_database", "sqlserver_schema",
                                    "secret_scope", "gateway_pipeline_id", "run_id"], defaults={"run_id": "manual"})
catalog, schema = params["catalog"], params["schema"]

import lfc_lib as l
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
l.require_ready(w, params["sqlserver_connection"], params["secret_scope"])

# COMMAND ----------

# MAGIC %md The host and port come from the connection; the job never stores them separately.

# COMMAND ----------

connection = w.connections.get(params["sqlserver_connection"])
host, port = l.source_settings(w, params["sqlserver_connection"])
print(f"{connection.name}: {connection.connection_type.value} {host}:{port}, owner {connection.owner}")
print("trustServerCertificate =", (connection.options or {}).get("trustServerCertificate", "false (default)"))

try:
    source = l.connect(host, port, params["sqlserver_database"],
                       dbutils.secrets.get(params["secret_scope"], "sqlserver_app_user"),
                       dbutils.secrets.get(params["secret_scope"], "sqlserver_app_password"))
except Exception as error:
    raise RuntimeError(f"Cannot open {params['sqlserver_database']} on {host}:{port} as the application login ({type(error).__name__}: {str(error)[:150]}). "
                       f"Check the network path and the login. Run: nc -vz {host} {port} from a machine on the gateway's network, and "
                       "sqlcmd -S <server> -d <database> -U <setup_user> -P <password> -N -i source/01_setup_source.sql "
                       "-v IngestPassword=<ingest-password> AppPassword=<app-password>. Nothing was changed.") from None
try:
    version = l.query(source, "SELECT @@VERSION AS version, dbo.lakeflowUtilityVersion() AS utility_version")[0]
except Exception as error:
    raise RuntimeError(f"The Databricks utility objects are not installed in {params['sqlserver_database']} ({type(error).__name__}). "
                       "Run: sqlcmd -S <server> -d <database> -U <setup_user> -P <password> -N -i utility_script.sql, then "
                       "the same command with source/01_setup_source.sql. Nothing was changed.") from None
print(version["version"].splitlines()[0], "| utility objects", version["utility_version"])

# COMMAND ----------

capture = l.query(source, l.CAPTURE_SQL, [params["sqlserver_schema"]])
display(spark.createDataFrame(capture))
problems = l.capture_problems(capture)
assert not problems, "Source is not ready: " + "; ".join(problems)

# COMMAND ----------

# MAGIC %md The gateway is a continuous pipeline on classic compute. Start it if it is idle and wait until it runs; the first start takes a few minutes while the cluster comes up.

# COMMAND ----------

state = l.ensure_running(w, params["gateway_pipeline_id"])
print("gateway", state)

rows = [(f"{row['table_name']}_rows", row["row_count"], "cdc" if row["cdc_on"] else "change_tracking") for row in capture]
rows.append(("gateway_running", 1, state))
l.write_results(spark, catalog, schema, params["run_id"], "check_source", rows)
