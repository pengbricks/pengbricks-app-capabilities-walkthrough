# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 7. Clean up
# MAGIC
# MAGIC Removes what this guide created outside the sample tables: the `edm_` ABAC policies (or the fallback mask and row filter) and the `edm_` external metadata objects with their relationships. It is gated by the `cleanup` parameter, which defaults to `keep`. With `keep` it prints what it would remove and changes nothing. Set `cleanup` to `drop` to remove them.
# MAGIC
# MAGIC The sample tables, the `edm_` tags, and the governed tag policies stay. Governed tags live at the account level, so delete them on purpose: `w.tag_policies.delete_tag_policy('edm_pii')` and `'edm_region'`. Nothing here costs money while idle.
# MAGIC
# MAGIC Safe to rerun: every removal checks first and uses `IF EXISTS` or a lookup, so a second run finds nothing and does nothing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_unity_catalog_edm", ['catalog', 'schema', 'cleanup'])

# COMMAND ----------

from types import SimpleNamespace
from governance_lib.sqlgen import qualified
from governance_lib import edm
from governance_lib.edm_api import lineage_object, related_names

args = SimpleNamespace(catalog=params["catalog"], schema=params["schema"], cleanup=params["cleanup"].lower())
assert args.cleanup in ("keep", "drop"), "cleanup must be keep or drop"

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

def cleanup(args, spark) -> None:
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.catalog import DeleteRequestExternalLineage, LineageDirection

    w = WorkspaceClient()
    table = qualified(args.catalog, args.schema, edm.CUSTOMERS)
    try:
        names = edm.plan_removal([m.name for m in w.external_metadata.list_external_metadata()], edm.EXTERNAL_PREFIX)
    except Exception as exc:  # noqa: BLE001
        print(f"could not list external metadata ({type(exc).__name__}); skipping those")
        names = []
    has_table = spark.catalog.tableExists(table)
    print(f"cleanup = {args.cleanup}")
    print("policies to drop:", [edm.MASK_POLICY, edm.REGION_POLICY] if has_table else "none (table is gone)")
    print("external metadata to delete:", names or "none")
    if args.cleanup == "keep":
        print("Nothing changed. Set the cleanup parameter to drop to remove these.")
        return

    if has_table:
        for policy in (edm.MASK_POLICY, edm.REGION_POLICY):
            try:
                spark.sql(edm.drop_policy_sql(policy, table))
            except Exception as exc:  # noqa: BLE001
                if not edm.policy_missing(exc):
                    raise
        # The plain-mode fallback attached a mask and a row filter; drop them if they are there.
        for statement in (f"ALTER TABLE {table} ALTER COLUMN `national_id` DROP MASK", f"ALTER TABLE {table} DROP ROW FILTER"):
            try:
                spark.sql(statement)
            except Exception as exc:  # noqa: BLE001
                print("nothing to drop:", statement.split(table)[-1].strip(), f"({type(exc).__name__})")
    full = lambda t: f"{args.catalog}.{args.schema}.{t}"  # noqa: E731
    for ref in ({"table": full(edm.CUSTOMERS)}, {"table": full(edm.GOLD)}) if names else ():
        for direction in (LineageDirection.UPSTREAM, LineageDirection.DOWNSTREAM):
            for other in sorted(related_names(w, ref, direction) & set(names)):
                src, dst = (ref, {"external": other}) if direction == LineageDirection.DOWNSTREAM else ({"external": other}, ref)
                try:
                    w.external_lineage.delete_external_lineage_relationship(
                        DeleteRequestExternalLineage(source=lineage_object(src), target=lineage_object(dst)))
                    print("deleted relationship", src, "->", dst)
                except Exception as exc:  # noqa: BLE001
                    print("relationship already gone:", type(exc).__name__)
    for name in names:
        try:
            w.external_metadata.delete_external_metadata(name)
            print("deleted external metadata", name)
        except Exception as exc:  # noqa: BLE001
            print(f"{name} already gone ({type(exc).__name__})")
    print("cleanup finished")

# COMMAND ----------

cleanup(args, spark)
