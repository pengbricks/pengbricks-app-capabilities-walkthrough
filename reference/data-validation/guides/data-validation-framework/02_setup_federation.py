# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Set up federation
# MAGIC
# MAGIC Creates or refreshes the Unity Catalog connection that exposes the source. The connection stores a Lakebase OAuth token as its password. Tokens last about an hour, so every run replaces the token. A production setup uses a long-lived credential from a secret store and, for SQL Server, the SQL Server connection type instead.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_data_validation", ['catalog', 'schema', 'use_case', 'lakebase_project'])
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.catalog import ConnectionType
import dv_lib

spec = dv_lib.load_spec(SPEC_FILE)
cfg = {**spec["source"], **({"lakebase_project": params["lakebase_project"]} if params["lakebase_project"] else {})}
w = WorkspaceClient()
s = dv_lib.connection_settings(w, cfg)
options = {"host": s["host"], "port": str(s["port"]), "user": s["user"], "password": s["password"]}

name = cfg["connection_name"]
try:
    w.connections.get(name)
    w.connections.update(name=name, options=options)
    print(f"Updated connection {name} with a fresh token")
except NotFound:
    w.connections.create(name=name, connection_type=ConnectionType.POSTGRESQL, options=options, comment="Lakebase Postgres stand-in source for the data validation guide")
    print(f"Created connection {name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Probe with remote_query
# MAGIC
# MAGIC `remote_query` runs the SQL inside the source and returns only the result. A foreign catalog (`CREATE FOREIGN CATALOG ... USING CONNECTION`) gives the same reach as ordinary table names, but needs CREATE CATALOG on the metastore. This guide uses `remote_query` so it needs neither.

# COMMAND ----------

probe = dv_lib.remote_query(spark, name, cfg["lakebase_database"], f"SELECT count(*) AS n FROM {dv_lib.ident(cfg['schema'])}.orders").first()["n"]
print(f"remote_query sees {probe} orders in the source")
assert int(probe) == spec["data"]["orders"]
