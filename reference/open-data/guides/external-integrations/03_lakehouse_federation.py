# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Lakehouse Federation
# MAGIC
# MAGIC Reads an external Postgres database through a Unity Catalog connection and foreign catalog. The "external" database is the Lakebase Postgres project named in the `lakebase_project` widget.
# MAGIC
# MAGIC The notebook seeds a table over a direct Postgres connection, registers the connection, and creates a foreign catalog. If the workspace blocks `CREATE CATALOG`, it reads through `remote_query` on the same connection instead. It queries the table in place, joins it to a Unity Catalog table, and drops the connection and any foreign catalog at the end so no credential is left behind. Safe to rerun: the Postgres table is dropped and reseeded, the connection and foreign catalog are dropped before and after, and the pattern's rows in `integration_checks` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from open_data.checks import append_rows, check_row, scrub
from open_data.federation import is_missing_privilege, remote_query_sql, seed_sql, require_lakebase_endpoint
from open_data.spec import load_spec
params = load_params(dbutils, "capability_guides_external_integrations", ['catalog', 'schema', 'use_case', 'lakebase_project'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"
import psycopg
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import ConnectionType

COLUMNS = ["guide", "pattern", "check", "status", "value", "detail", "recorded_at"]
cfg = {**load_spec(SPEC_FILE)["integrations"]["federation"], "lakebase_project": params["lakebase_project"]}
rows, secrets = [], []


def record(check, status, value, detail):
    detail = scrub(detail, secrets)
    rows.append(check_row("external-integrations", check, status, detail, value=value, pattern="federation"))
    print(f"[{status}] {check}: {detail}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Find the Postgres endpoint and get a token

# COMMAND ----------

w = WorkspaceClient()
endpoint_name = f"projects/{cfg['lakebase_project']}/branches/{cfg['lakebase_branch']}/endpoints/{cfg['lakebase_endpoint']}"
host = require_lakebase_endpoint(w, endpoint_name).status.hosts.host
user = w.current_user.me().user_name
token = w.postgres.generate_database_credential(endpoint=endpoint_name).token
secrets.append(token)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Seed the external table
# MAGIC
# MAGIC The seed drops and recreates the table, so a rerun gets the same rows.

# COMMAND ----------

ext_schema, ext_table = cfg["source_schema"], cfg["source_table"]
with psycopg.connect(host=host, dbname=cfg["database"], user=user, password=token, sslmode="require", connect_timeout=30) as pg:
    for statement in seed_sql(ext_schema, ext_table, int(cfg["source_rows"])):
        pg.execute(statement)
    pg_count, pg_sum = pg.execute(f"SELECT count(*), sum(amount) FROM {ext_schema}.{ext_table}").fetchone()
record("seed_external_source", "PASS", str(pg_count), f"Seeded {ext_schema}.{ext_table} in Postgres database {cfg['database']} ({endpoint_name}): {pg_count} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Register the connection and query in place
# MAGIC
# MAGIC The connection and any foreign catalog are dropped first, and again in the `finally` block, so the credential does not outlive the run.

# COMMAND ----------

connection, foreign = cfg["connection_name"], cfg["foreign_catalog"]
try:
    spark.sql(f"DROP CATALOG IF EXISTS {foreign} CASCADE")
    spark.sql(f"DROP CONNECTION IF EXISTS {connection}")
    w.connections.create(
        name=connection,
        connection_type=ConnectionType.POSTGRESQL,
        options={"host": host, "port": "5432", "user": user, "password": token},
        comment="Lakehouse Federation connection to the Lakebase Postgres project (capability guide)",
    )
    record("connection", "PASS", connection, f"UC connection {connection} (POSTGRESQL, user {user}) created")

    # Foreign catalog when the workspace allows it; otherwise read through the same connection with remote_query.
    try:
        spark.sql(f"CREATE FOREIGN CATALOG {foreign} USING CONNECTION {connection} OPTIONS (database '{cfg['database']}')")
        source = f"{foreign}.{ext_schema}.{ext_table}"
        record("foreign_catalog", "PASS", foreign, f"Foreign catalog {foreign} created on connection {connection}")
    except Exception as error:
        if not is_missing_privilege(str(error)):
            raise
        source = remote_query_sql(connection, cfg["database"], f"SELECT * FROM {ext_schema}.{ext_table}")
        record("foreign_catalog", "BLOCKED", "0", f"{user} lacks CREATE CATALOG on the metastore, so no foreign catalog. A metastore admin can grant it. The reads below use remote_query on the same connection.")

    fed = spark.sql(f"SELECT count(*) AS n, sum(amount) AS total FROM {source}").first()
    ok = fed["n"] == pg_count and float(fed["total"]) == float(pg_sum)
    record("query_external_table", "PASS" if ok else "FAIL", str(fed["n"]), f"Federated query returned {fed['n']} rows, total {fed['total']}; Postgres reports {pg_count} rows, total {pg_sum}")

    joined = spark.sql(
        f"SELECT p.product, count(*) AS orders FROM {source} o JOIN {prefix}.sharing_products p ON o.product = p.product GROUP BY p.product"
    ).collect()
    joined_total = sum(r["orders"] for r in joined)
    record("join_with_uc_table", "PASS" if joined_total == pg_count else "FAIL", str(joined_total), f"Join with {prefix}.sharing_products returned {len(joined)} products covering {joined_total} rows")

    remote = remote_query_sql(connection, cfg["database"], f"SELECT region, count(*) AS n FROM {ext_schema}.{ext_table} GROUP BY region")
    by_region = {r["region"]: r["n"] for r in spark.sql(f"SELECT * FROM {remote}").collect()}
    record("aggregate_runs_in_postgres", "PASS" if sum(by_region.values()) == pg_count else "FAIL", str(len(by_region)), f"Postgres aggregated by region and returned {len(by_region)} rows: {dict(sorted(by_region.items()))}")
finally:
    spark.sql(f"DROP CATALOG IF EXISTS {foreign} CASCADE")
    spark.sql(f"DROP CONNECTION IF EXISTS {connection}")
    record("cleanup", "INFO", "dropped", f"Connection {connection} and any foreign catalog dropped; the OAuth token used as the password expires within an hour")
    append_rows(spark, f"{prefix}.integration_checks", rows, COLUMNS, replace_where="pattern = 'federation'")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Result

# COMMAND ----------

failed = [r["check"] for r in rows if r["status"] == "FAIL"]
if failed:
    raise Exception(f"Failed checks: {failed}")
display(spark.table(f"{prefix}.integration_checks").where("pattern = 'federation'"))
