# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Certify the gold table
# MAGIC
# MAGIC Sets the system governed tag `system.certification_status` to `certified` on `edm_customer_revenue_gold` and shows it. This is the step an EDM approval workflow performs when a steward signs off. Setting it needs `ASSIGN` on the tag and `APPLY TAG` on the table. If the job identity lacks either, the notebook says so and records `not permitted` instead of failing.
# MAGIC
# MAGIC Safe to rerun: setting a tag to the value it already has changes nothing, and `edm_certification_status` is replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_unity_catalog_edm", ['catalog', 'schema'])

# COMMAND ----------

from types import SimpleNamespace
from governance_lib.sqlgen import qualified
from governance_lib import edm
from common import write_rows

args = SimpleNamespace(catalog=params["catalog"], schema=params["schema"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

def certify_gold(args, spark) -> None:
    table = qualified(args.catalog, args.schema, edm.GOLD)
    try:
        spark.sql(edm.certification_sql(table))
        outcome = "set"
    except Exception as exc:  # noqa: BLE001
        outcome = "not permitted"
        print(f"could not set {edm.CERTIFICATION_TAG}: {type(exc).__name__}: {str(exc)[:200]}")
        print("The job identity needs ASSIGN on the tag and APPLY TAG on the table.")
    info = f"{qualified(args.catalog)}.information_schema.table_tags"
    shown = spark.sql(f"""SELECT table_name, tag_name, tag_value FROM {info}
        WHERE schema_name = '{args.schema}' AND table_name = '{edm.GOLD}' AND tag_name = '{edm.CERTIFICATION_TAG}'""").collect()
    value = shown[0]["tag_value"] if shown else ""
    print("certification tag on the gold table:", [r.asDict() for r in shown] or "not set")
    write_rows(spark, args.catalog, args.schema, "edm_certification_status",
               [{"table_name": edm.GOLD, "tag_name": edm.CERTIFICATION_TAG, "tag_value": value, "outcome": outcome}],
               "table_name string, tag_name string, tag_value string, outcome string")

# COMMAND ----------

REQUIRED = ['edm_customer_revenue_gold']
missing = [t for t in REQUIRED if not spark.catalog.tableExists(qualified(args.catalog, args.schema, t))]
if missing:
    raise RuntimeError(f"{', '.join(missing)} missing in {args.catalog}.{args.schema}. Run: the 01_create_sample_tables notebook, or databricks bundle run capability_guides_unity_catalog_edm --target dev. Nothing was changed.")
certify_gold(args, spark)
