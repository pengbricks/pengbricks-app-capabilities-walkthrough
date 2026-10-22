# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Apply tags as the EDM contract
# MAGIC
# MAGIC The `tag_mode` parameter picks the path. `governed` (default) creates the governed tags below, which are account-level objects. `plain` creates nothing at the account level: it applies the same tags as plain tags, and step 3 uses a column mask and row filter. Governed mode adds tag policies that fix the allowed values and who may assign them, and it lets an ABAC policy match on the tag.
# MAGIC
# MAGIC The EDM tool says what a column holds. Unity Catalog stores that as a tag. This step defines two governed tags, `edm_pii` (values `id_number`, `contact`) and `edm_region`, applies them to the sensitive columns, and adds plain table tags for the domain and the steward group. Governed tags are what an ABAC policy reads in step 3.
# MAGIC
# MAGIC Creating a governed tag needs permission on the account's tag policies. If the job identity lacks it, this step says so, applies the same tags as plain tags, and lists the governed tags that already exist in the account. Step 3 then uses a column mask and row filter instead of ABAC. The row and column security guide attaches masks by hand and creates no governed tags, so there is nothing there to reuse for the tags themselves.
# MAGIC
# MAGIC Safe to rerun: a tag policy that exists is updated in place, tags are overwritten with the same values, and `edm_tag_contract` is replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_unity_catalog_edm", ['catalog', 'schema', 'tag_mode'])

# COMMAND ----------

from types import SimpleNamespace
from governance_lib.sqlgen import qualified
from governance_lib import edm
from common import write_rows

args = SimpleNamespace(catalog=params["catalog"], schema=params["schema"], tag_mode=edm.normalize_tag_mode(params["tag_mode"]))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

CONTRACT_DDL = ("table_name string, column_name string, tag_key string, tag_value string, tag_kind string, "
                "applied boolean, note string")

def ensure_governed_tags(w) -> tuple[bool, str]:
    """Create each governed tag if missing, update it in place if present. Returns (available, reason)."""
    from databricks.sdk.errors import AlreadyExists, ResourceAlreadyExists
    from databricks.sdk.service.tags import TagPolicy, Value

    try:
        existing = {p.tag_key for p in w.tag_policies.list_tag_policies()}
    except Exception:  # noqa: BLE001
        existing = set()
    plan = edm.plan_upsert(existing, [t["key"] for t in edm.GOVERNED_TAGS])
    for tag in edm.GOVERNED_TAGS:
        policy = TagPolicy(tag_key=tag["key"], description=tag["description"],
                           values=[Value(name=v) for v in tag["values"]] or None)
        try:
            if tag["key"] in plan["update"]:
                w.tag_policies.update_tag_policy(tag["key"], policy, update_mask="description,values")
                print(f"governed tag {tag['key']}: exists, updated in place")
            else:
                w.tag_policies.create_tag_policy(policy)
                print(f"governed tag {tag['key']}: created")
        except (AlreadyExists, ResourceAlreadyExists):
            print(f"governed tag {tag['key']}: already exists")
        except Exception as exc:  # noqa: BLE001
            if tag["key"] in plan["update"]:
                print(f"governed tag {tag['key']}: exists, left as is ({type(exc).__name__})")
            else:
                return False, f"{type(exc).__name__}: {str(exc)[:200]}"
    return True, ""

def apply_tag(spark, table: str, key: str, value: str, column: str | None, governed: bool) -> tuple[str, bool, str]:
    """Set one tag. Governed tags use SET TAG ON; plain tags and any failure fall back to ALTER ... SET TAGS."""
    if governed:
        try:
            obj = f"{table}.{qualified(column)}" if column else table
            spark.sql(edm.set_tag_sql("COLUMN" if column else "TABLE", obj, key, value))
            return "governed", True, ""
        except Exception as exc:  # noqa: BLE001
            note = f"SET TAG failed ({type(exc).__name__}); applied as a plain tag"
    else:
        note = ""
    try:
        spark.sql(edm.alter_tag_sql(table, key, value, column))
        return "plain", True, note
    except Exception as exc:  # noqa: BLE001
        return "plain", False, f"{note} {type(exc).__name__}: {str(exc)[:150]}".strip()

def apply_tags(args, spark) -> None:
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    q = lambda name: qualified(args.catalog, args.schema, name)  # noqa: E731
    if args.tag_mode == "plain":
        governed, reason = False, "tag_mode is plain"
        print("MODE plain (requested): no governed tags are created, so nothing is created at the account level.")
        print("Governed mode would add tag policies with allowed values and ASSIGN control, and let step 3 use ABAC.")
    else:
        governed, reason = ensure_governed_tags(w)
    if args.tag_mode == "plain":
        pass
    elif governed:
        print("MODE governed: the job identity can manage the governed tags, so step 3 can use ABAC")
    else:
        print(f"MODE plain (fallback): could not create governed tags ({reason}).")
        print("Falling back to plain tags. Step 3 will use a column mask and row filter instead of ABAC.")
        try:
            if args.tag_mode == "plain":
                raise LookupError
            names = sorted(p.tag_key for p in w.tag_policies.list_tag_policies() if not p.tag_key.startswith(("class.", "system.")))
            print("governed tags that already exist in this account:", names[:20] or "none")
        except LookupError:
            pass
        except Exception as exc:  # noqa: BLE001
            print("could not list existing governed tags:", type(exc).__name__)

    rows = []
    for tag in edm.COLUMN_TAGS:
        kind, ok, note = apply_tag(spark, q(tag["table"]), tag["key"], tag["value"], tag["column"], governed)
        rows.append({"table_name": tag["table"], "column_name": tag["column"], "tag_key": tag["key"],
                     "tag_value": tag["value"], "tag_kind": kind, "applied": ok, "note": note})
    for tag in edm.TABLE_TAGS:
        kind, ok, note = apply_tag(spark, q(tag["table"]), tag["key"], tag["value"], None, False)
        rows.append({"table_name": tag["table"], "column_name": None, "tag_key": tag["key"],
                     "tag_value": tag["value"], "tag_kind": kind, "applied": ok, "note": note})
    write_rows(spark, args.catalog, args.schema, "edm_tag_contract", rows, CONTRACT_DDL)
    for row in rows:
        print(row)
    failed = [r for r in rows if not r["applied"]]
    assert not failed, f"tags not applied: {failed}"
    print("tag mode for step 3:", edm.contract_mode(rows))

# COMMAND ----------

REQUIRED = ['edm_customers', 'edm_orders', 'edm_customer_revenue_gold']
missing = [t for t in REQUIRED if not spark.catalog.tableExists(qualified(args.catalog, args.schema, t))]
if missing:
    raise RuntimeError(f"{', '.join(missing)} missing in {args.catalog}.{args.schema}. Run: the 01_create_sample_tables notebook, or databricks bundle run capability_guides_unity_catalog_edm --target dev. Nothing was changed.")
apply_tags(args, spark)
