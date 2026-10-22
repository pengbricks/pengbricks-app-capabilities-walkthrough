# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Build the metadata feed for an EDM tool
# MAGIC
# MAGIC An EDM scanner reads Unity Catalog through `information_schema` and the lineage system tables. This step builds the same feed as Delta tables named `edm_metadata_feed_*`: tables with comments, columns with comments, tags, privileges, and table and column lineage from `system.access.table_lineage` and `system.access.column_lineage`. Then it prints the least-privilege `GRANT` statements for a scanner service principal. It prints them and does not run them, because the principal may not exist.
# MAGIC
# MAGIC `information_schema` shows only the objects the reader can see, so the scanner's grants set the scope of what it exports. System-table lineage appears a few minutes after a query runs, so the lineage tables can be empty on a first run and filled on the next. External lineage from step 5 is not in these tables.
# MAGIC
# MAGIC Safe to rerun: each feed table is created with `CREATE OR REPLACE`, and the grants are printed, not run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_unity_catalog_edm", ['catalog', 'schema', 'scanner_principal'])

# COMMAND ----------

from types import SimpleNamespace
from governance_lib.sqlgen import qualified
from governance_lib import edm

args = SimpleNamespace(catalog=params["catalog"], schema=params["schema"], scanner=params["scanner_principal"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

def metadata_feed(args, spark) -> None:
    q = lambda name: qualified(args.catalog, args.schema, name)  # noqa: E731
    for name, select in edm.feed_queries(args.catalog, args.schema).items():
        try:
            spark.sql(f"CREATE OR REPLACE TABLE {q(name)} AS {select}")
        except Exception as exc:  # noqa: BLE001
            if "lineage" not in name:
                raise
            print(f"SKIPPED {name}: the job identity cannot read system.access ({type(exc).__name__}). Grant SELECT on it to build the lineage feed.")
            continue
        print(f"{name}: {spark.table(q(name)).count()} rows")
    if spark.catalog.tableExists(q("edm_metadata_feed_table_lineage")) and spark.table(q("edm_metadata_feed_table_lineage")).count() == 0:
        print("No lineage rows yet. System-table lineage lags a few minutes: rerun this step later.")

    print(f"\n-- Least-privilege grants for the scanner `{args.scanner}`. Review, then run them as a metastore admin or owner.")
    print("-- Also give it CAN USE on one SQL warehouse (a warehouse permission, not a GRANT).")
    for statement in edm.scanner_grants(args.scanner, args.catalog, args.schema):
        print(statement + ";")

# COMMAND ----------

metadata_feed(args, spark)
