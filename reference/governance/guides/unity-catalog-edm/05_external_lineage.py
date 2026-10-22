# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Register external lineage
# MAGIC
# MAGIC Registers two things Databricks cannot see: a table in a non-Databricks source (a PostgreSQL CRM database) and a BI report, as external metadata objects. Then it relates them to Unity Catalog tables: the CRM table feeds `edm_customers`, and the gold table feeds the report. It reads the relationships back. The objects use `example.com` URLs, so nothing points at a real system.
# MAGIC
# MAGIC This uses the External Metadata and External Lineage APIs (Databricks SDK `external_metadata` and `external_lineage`, which call `/api/2.0/lineage-tracking/external-metadata` and `/external-lineage`). Creating objects needs `CREATE EXTERNAL METADATA` on the metastore. Without it the step records `SKIPPED` and ends cleanly. External lineage shows in Catalog Explorer. It is not written to `system.access.table_lineage`, so the feed from step 4 does not carry it.
# MAGIC
# MAGIC Safe to rerun: objects are looked up by name and updated in place when they exist, relationships are created only when missing, and `edm_external_lineage` is replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_unity_catalog_edm", ['catalog', 'schema'])

# COMMAND ----------

from types import SimpleNamespace
from governance_lib.sqlgen import qualified
from governance_lib import edm
from governance_lib.edm_api import lineage_object, ref_name, related_names
from common import write_rows

args = SimpleNamespace(catalog=params["catalog"], schema=params["schema"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

LINEAGE_DDL = "object_kind string, name string, direction string, related string, status string, note string"

def upsert_metadata(w, spec: dict, existing: set[str]) -> str:
    from databricks.sdk.service.catalog import ExternalMetadata, SystemType

    obj = ExternalMetadata(name=spec["name"], system_type=SystemType(spec["system_type"]), entity_type=spec["entity_type"],
                           url=spec["url"], description=spec["description"], columns=spec["columns"] or None,
                           properties=spec["properties"])
    if spec["name"] in existing:
        w.external_metadata.update_external_metadata(spec["name"], obj, update_mask="entity_type,url,description,columns,properties")
        return "updated"
    w.external_metadata.create_external_metadata(obj)
    return "created"

def upsert_relationship(w, rel: dict) -> str:
    from databricks.sdk.errors import AlreadyExists, ResourceAlreadyExists
    from databricks.sdk.service.catalog import (ColumnRelationship, CreateRequestExternalLineage, LineageDirection,
                                                UpdateRequestExternalLineage)

    target_name = ref_name(rel["target"])
    present = related_names(w, rel["source"], LineageDirection.DOWNSTREAM)
    columns = [ColumnRelationship(source=c["source"], target=c["target"]) for c in rel["columns"]] or None
    source, target = lineage_object(rel["source"]), lineage_object(rel["target"])
    if target_name in present:
        if columns:
            w.external_lineage.update_external_lineage_relationship(
                UpdateRequestExternalLineage(source=source, target=target, columns=columns), update_mask="columns")
        return "updated"
    try:
        w.external_lineage.create_external_lineage_relationship(CreateRequestExternalLineage(source=source, target=target, columns=columns))
        return "created"
    except (AlreadyExists, ResourceAlreadyExists):
        return "updated"

def register_external_lineage(args, spark) -> None:
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.catalog import LineageDirection

    w = WorkspaceClient()
    plan = edm.external_objects(args.catalog, args.schema)
    rows = []
    try:
        existing = {m.name for m in w.external_metadata.list_external_metadata()}
        for spec in plan["metadata"]:
            rows.append({"object_kind": "external metadata", "name": spec["name"], "direction": "", "related": spec["system_type"],
                         "status": upsert_metadata(w, spec, existing), "note": spec["url"]})
        for rel in plan["relationships"]:
            status = upsert_relationship(w, rel)
            rows.append({"object_kind": "relationship", "name": ref_name(rel["source"]), "direction": "feeds",
                         "related": ref_name(rel["target"]), "status": status, "note": ""})
    except Exception as exc:  # noqa: BLE001
        print(f"SKIPPED: {type(exc).__name__}: {str(exc)[:200]}")
        print("Creating external metadata needs CREATE EXTERNAL METADATA on the metastore. Ask a metastore admin to grant it, then rerun.")
        rows.append({"object_kind": "external metadata", "name": "(all)", "direction": "", "related": "", "status": "SKIPPED", "note": str(exc)[:200]})
        write_rows(spark, args.catalog, args.schema, "edm_external_lineage", rows, LINEAGE_DDL)
        return

    # Read it back: each anchor in both directions.
    full = lambda t: f"{args.catalog}.{args.schema}.{t}"  # noqa: E731
    anchors = [{"table": full(edm.CUSTOMERS)}, {"table": full(edm.GOLD)}]
    for ref in anchors:
        for direction in (LineageDirection.UPSTREAM, LineageDirection.DOWNSTREAM):
            for name in sorted(related_names(w, ref, direction)):
                rows.append({"object_kind": "read back", "name": ref["table"], "direction": direction.value, "related": name,
                             "status": "found", "note": ""})
    write_rows(spark, args.catalog, args.schema, "edm_external_lineage", rows, LINEAGE_DDL)
    for row in rows:
        print(row)
    found = {(r["name"].split(".")[-1], r["direction"], r["related"]) for r in rows if r["status"] == "found"}
    assert (edm.CUSTOMERS, "UPSTREAM", f"{edm.EXTERNAL_PREFIX}crm_customers") in found, "external source not read back"
    assert (edm.GOLD, "DOWNSTREAM", f"{edm.EXTERNAL_PREFIX}revenue_report") in found, "BI report not read back"

# COMMAND ----------

register_external_lineage(args, spark)
