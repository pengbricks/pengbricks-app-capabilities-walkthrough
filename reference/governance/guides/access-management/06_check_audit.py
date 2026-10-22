# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Check the audit table
# MAGIC
# MAGIC Reads back `access_audit_grant_changes`, which the SQL task `05_audit_grant_changes.sql` writes from `system.access.audit`.

# MAGIC
# MAGIC Safe to rerun: it only reads the audit table.
# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_access", ['catalog', 'schema', 'use_case', 'reader_group', 'app_service_principal', 'dev_schema', 'prod_schema'])

# COMMAND ----------

import datetime as dt
from types import SimpleNamespace
from common import run_sql_rows, workspace_id, write_rows
from governance_lib.datagen import write_table
from governance_lib.spec import load_spec
from governance_lib.sqlgen import grant_sql, principal_kind, qualified

args = SimpleNamespace(
    catalog=params["catalog"],
    schema=params["schema"],
    use_case_file=str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"),
    reader_group=params["reader_group"],
    app_service_principal=params["app_service_principal"],
    dev_schema=params["dev_schema"],
    prod_schema=params["prod_schema"],
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The step

# COMMAND ----------

def check_audit(args, spark) -> None:
    """Read back the grant-change table written by sql/permission_audit_task.sql."""
    table = qualified(args.catalog, args.schema, "access_audit_grant_changes")
    total = spark.sql(f"SELECT count(*) c FROM {table}").first()["c"]
    ours = spark.sql(f"""SELECT count(*) c FROM {table} WHERE securable LIKE '%{args.dev_schema}%' OR securable LIKE '%{args.prod_schema}%'""").first()["c"]
    print(f"grant changes in the last 30 days in this catalog: {total}; on this guide's schemas: {ours}")

# COMMAND ----------

check_audit(args, spark)
