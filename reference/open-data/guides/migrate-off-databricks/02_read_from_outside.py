# Databricks notebook source
# MAGIC %md
# MAGIC # 2. Read from outside
# MAGIC
# MAGIC Shows how an outside engine reads a table through the Unity Catalog Iceberg REST catalog: the endpoint URL, the PyIceberg configuration, and the Spark catalog settings for an open-source engine. The notebook prints them. It never connects to an outside system and never prints a token.
# MAGIC
# MAGIC Safe to rerun: read-only. It reads `exit_inventory` and the metastore summary, and creates nothing.
# MAGIC
# MAGIC ## Required setup
# MAGIC
# MAGIC A real outside read needs both of these, once:
# MAGIC
# MAGIC 1. **External data access on the metastore.** A metastore admin turns it on: `databricks metastores update <metastore-id> --external-access-enabled`. The first cell below reports the current value.
# MAGIC 2. **EXTERNAL USE SCHEMA** on the schema for the principal the engine uses: ``GRANT EXTERNAL USE SCHEMA ON SCHEMA <catalog>.<schema> TO `<principal>` ``. That principal also needs `SELECT` on the table.
# MAGIC
# MAGIC Use a service principal with OAuth machine-to-machine credentials for the engine. The Databricks docs show Iceberg 1.9.2 in their Spark examples. Pick the runtime JAR that matches your Spark and Scala versions. Delta tables are readable this way only with Iceberg reads (UniForm) enabled, and the access is read-only.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from open_data.iceberg import catalog_properties
params = load_params(dbutils, "capability_guides_migrate_off_databricks", ['catalog', 'schema'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"
IRC_PATH = "/api/2.1/unity-catalog/iceberg-rest"

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
summary = w.metastores.summary()
print(f"External data access enabled on the metastore: {summary.external_access_enabled}")
if summary.external_access_enabled is False:
    print(f"Off. A metastore admin runs: databricks metastores update {summary.metastore_id} --external-access-enabled")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pick a table an Iceberg client can read
# MAGIC
# MAGIC Takes the first table in `exit_inventory` that is native Iceberg or has Iceberg reads enabled. Run `01_exit_inventory` first.

# COMMAND ----------

candidates = spark.sql(f"""
  SELECT table_name, iceberg_readability FROM {prefix}.exit_inventory
  WHERE iceberg_readability <> 'none' AND table_type IN ('MANAGED', 'EXTERNAL')
  ORDER BY table_name
""").collect()
if candidates:
    name = candidates[0].table_name.split(".")[-1]
    print(f"Example table: {schema}.{name} ({candidates[0].iceberg_readability}); {len(candidates)} Iceberg-readable in total")
else:
    name = "<table>"
    print("No Iceberg-readable table in exit_inventory. Enable Iceberg reads on a Delta table or create a managed Iceberg table, then rerun.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## PyIceberg configuration
# MAGIC
# MAGIC The token placeholder stands for an OAuth access token that the service principal gets from `<workspace-host>/oidc/v1/token`. The `X-Iceberg-Access-Delegation` header asks Unity Catalog for short-lived storage credentials, so the engine holds no storage keys.

# COMMAND ----------

props = catalog_properties(w.config.host, catalog, IRC_PATH, "<OAuth access token>")
print("Iceberg REST endpoint:", props["uri"])
print()
print("from pyiceberg.catalog import load_catalog")
print(f'catalog = load_catalog("unity", **{props!r})')
print(f'table = catalog.load_table("{schema}.{name}")')
print("df = table.scan().to_arrow()")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Other access paths
# MAGIC
# MAGIC - **OpenSharing.** For another organization or platform, create a share and a recipient instead of giving out a service principal. See the data-sharing guide.
# MAGIC - **Direct files.** An external table's files sit at its `location` in `exit_inventory`. Any engine with access to that storage reads them. Managed tables do not support path-based access through Databricks.

# COMMAND ----------

print("Direct file locations of external tables:")
display(spark.sql(f"SELECT table_name, format, location FROM {prefix}.exit_inventory WHERE managed_or_external = 'external'"))
