# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Create the ABAC policy and test it as the job identity
# MAGIC
# MAGIC Creates a masking function and a row-filter function, then two `CREATE POLICY` statements on `edm_customers`. The mask policy matches columns tagged `edm_pii = id_number`. The row policy matches columns tagged `edm_region`. Neither names a column, so a new table that carries the tag picks the policy up. The job then queries the table and compares what it sees with the baseline from step 1.
# MAGIC
# MAGIC ABAC policies are generally available and need serverless compute or Databricks Runtime 16.4 or above. The policies apply to `account users` with no exempt group, so the job identity sees masked data. Add `EXCEPT <group>` for stewards. To cover every table in the schema, move `ON TABLE` to `ON SCHEMA`.
# MAGIC
# MAGIC If step 2 ended in plain mode, the notebook attaches the same functions with `ALTER TABLE ... SET MASK` and `SET ROW FILTER` and says so.
# MAGIC
# MAGIC Safe to rerun: functions use `CREATE OR REPLACE`, an existing policy of the same name is dropped with `IF EXISTS` and recreated, and `edm_policy_check` is replaced.

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

CHECK_DDL = "check_name string, expected string, actual string, passed boolean"

def create_policies(args, spark, mode: str) -> str:
    q = lambda name: qualified(args.catalog, args.schema, name)  # noqa: E731
    table, mask_fn, filter_fn = q(edm.CUSTOMERS), q(edm.MASK_FUNCTION), q(edm.REGION_FUNCTION)
    spark.sql(edm.last4_mask_sql(mask_fn))
    spark.sql(edm.region_filter_sql(filter_fn))
    for name in (edm.MASK_POLICY, edm.REGION_POLICY):
        try:
            spark.sql(edm.drop_policy_sql(name, table))  # replace, never add a second policy
        except Exception as exc:  # noqa: BLE001
            print(f"no policy {name} to drop ({type(exc).__name__})")
    if mode == "governed":
        # A mask or row filter from an earlier plain-mode run would stack with the policy: remove it.
        for statement in (f"ALTER TABLE {table} ALTER COLUMN `national_id` DROP MASK", f"ALTER TABLE {table} DROP ROW FILTER"):
            try:
                spark.sql(statement)
            except Exception:  # noqa: BLE001
                pass
        spark.sql(edm.mask_policy_sql(edm.MASK_POLICY, table, mask_fn, "account users", edm.TAG_PII, "id_number"))
        spark.sql(edm.row_filter_policy_sql(edm.REGION_POLICY, table, filter_fn, "account users", edm.TAG_REGION))
        print("created ABAC policies", edm.MASK_POLICY, "and", edm.REGION_POLICY)
        return "ABAC policy"
    print("MODE plain: the tags are plain, and ABAC matches only governed tags.")
    print("Governed mode (tag_mode=governed) would add CREATE POLICY rules that follow the tag to new tables.")
    print("Attaching the same functions the row and column security way (ALTER TABLE ... SET MASK / SET ROW FILTER).")
    spark.sql(f"ALTER TABLE {table} ALTER COLUMN `national_id` SET MASK {mask_fn}")
    spark.sql(f"ALTER TABLE {table} SET ROW FILTER {filter_fn} ON (`region`)")
    return "mask and row filter"

def abac_policy(args, spark) -> None:
    from databricks.sdk import WorkspaceClient

    q = lambda name: qualified(args.catalog, args.schema, name)  # noqa: E731
    contract = [r.asDict() for r in spark.table(q("edm_tag_contract")).collect()]
    mode = edm.contract_mode(contract)
    how = create_policies(args, spark, mode)
    if mode == "governed":
        try:
            names = [p.name for p in WorkspaceClient().policies.list_policies("TABLE", f"{args.catalog}.{args.schema}.{edm.CUSTOMERS}")]
            print("policies on", edm.CUSTOMERS, names)
        except Exception as exc:  # noqa: BLE001
            print("could not list policies:", type(exc).__name__)

    who = spark.sql("SELECT current_user() AS me").first()["me"]
    base = spark.table(q("edm_baseline_counts")).first()
    seen = spark.sql(f"SELECT count(*) AS n, count_if(region = '{edm.HIDDEN_REGION}') AS hidden FROM {q(edm.CUSTOMERS)}").first()
    sample = spark.sql(f"SELECT email, national_id FROM {q(edm.CUSTOMERS)} WHERE customer_id = 'CUST-000001'").first()
    print(f"queried as {who} through the {how}")
    print("row sample:", spark.sql(f"SELECT customer_id, email, national_id, region FROM {q(edm.CUSTOMERS)} ORDER BY customer_id LIMIT 3").collect())
    expected_rows = base["customers_total"] - base["customers_hidden_region"]
    checks = [
        ("rows visible", str(expected_rows), str(seen["n"]), seen["n"] == expected_rows),
        (f"{edm.HIDDEN_REGION} rows visible", "0", str(seen["hidden"]), seen["hidden"] == 0),
        ("national_id masked", "starts with *", sample["national_id"], str(sample["national_id"]).startswith("*")),
        ("email unmasked (not tagged id_number)", "user000001@example.com", sample["email"], sample["email"] == "user000001@example.com"),
    ]
    write_rows(spark, args.catalog, args.schema, "edm_policy_check",
               [{"check_name": a, "expected": b, "actual": c, "passed": bool(d)} for a, b, c, d in checks], CHECK_DDL)
    for a, b, c, d in checks:
        print("PASS" if d else "FAIL", a, "expected", b, "actual", c)
    assert all(c[3] for c in checks), "the policy did not change what the job identity sees"

# COMMAND ----------

abac_policy(args, spark)
