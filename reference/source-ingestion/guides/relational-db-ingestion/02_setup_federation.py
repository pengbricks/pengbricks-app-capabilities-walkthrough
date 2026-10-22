# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Set up federation
# MAGIC
# MAGIC Creates or refreshes the Unity Catalog connection that exposes Lakebase Postgres, plus a foreign catalog if allowed.
# MAGIC
# MAGIC The connection stores a Lakebase OAuth token as its password. Tokens last about an hour, so every run replaces the token. A production setup uses a Lakeflow Connect managed connector or a long-lived credential from a secret store instead. Safe to rerun: the connection is updated if it exists, and the foreign catalog is created only if missing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_relational_extract", ['catalog', 'schema', 'use_case', 'lakebase_project'])
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create or update the connection

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.catalog import ConnectionType
from source_ingestion import lakebase
from source_ingestion.spec import load_spec

cfg = load_spec(SPEC_FILE)["relational"]
if params["lakebase_project"]:
    cfg = {**cfg, "lakebase_project": params["lakebase_project"]}
w = WorkspaceClient()
s = lakebase.connection_settings(w, cfg["lakebase_project"], cfg["lakebase_branch"], cfg["lakebase_endpoint"], cfg["lakebase_database"])
options = {"host": s["host"], "port": str(s["port"]), "user": s["user"], "password": s["password"]}

name = cfg["connection_name"]
try:
    w.connections.get(name)
    w.connections.update(name=name, options=options)
    print(f"Updated connection {name} with a fresh token")
except NotFound:
    w.connections.create(name=name, connection_type=ConnectionType.POSTGRESQL, options=options, comment="Lakebase Postgres source for the capability guides")
    print(f"Created connection {name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Foreign catalog and probe
# MAGIC
# MAGIC A foreign catalog needs CREATE CATALOG on the metastore. Without it the connection still works through `remote_query`, which is what the extract uses.

# COMMAND ----------

catalog_name = cfg["foreign_catalog"]
try:
    spark.sql(f"CREATE FOREIGN CATALOG IF NOT EXISTS `{catalog_name}` USING CONNECTION `{name}` OPTIONS (database '{cfg['lakebase_database']}')")
    print(f"Foreign catalog {catalog_name} is available")
except Exception as exc:
    print(f"Foreign catalog {catalog_name} not created: {str(exc).splitlines()[0][:200]}")
inner = f"SELECT table_name FROM information_schema.tables WHERE table_schema = \\'{cfg['source_schema']}\\'"
probe = spark.sql(
    f"SELECT count(*) AS n FROM remote_query('{name}', database => '{cfg['lakebase_database']}', query => '{inner}')"
).first()["n"]
print(f"remote_query sees {probe} tables in schema {cfg['source_schema']}")
