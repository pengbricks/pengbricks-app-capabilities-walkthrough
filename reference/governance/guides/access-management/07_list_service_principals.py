# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 7. List service principals
# MAGIC
# MAGIC Writes the workspace's service principals, their roles and OAuth secret counts and expiry to `access_service_principals`. It reads secret metadata only and never creates or changes a secret.

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

def list_service_principals(args, spark) -> None:
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    rows = []
    for sp in w.service_principals.list():
        try:
            secrets = list(w.service_principal_secrets_proxy.list(service_principal_id=int(sp.id)))
        except Exception:  # noqa: BLE001
            secrets = []
        expiry = [s.expire_time for s in secrets if s.expire_time]
        created = [s.create_time for s in secrets if s.create_time]
        rows.append({
            "display_name": sp.display_name or "",
            "application_id": sp.application_id or "",
            "active": bool(sp.active),
            "roles": ", ".join(sorted(g.display for g in (sp.groups or []) if g.display)) or "(none)",
            "entitlements": ", ".join(sorted(e.value for e in (sp.entitlements or []))) or "(none)",
            "is_app_service_principal": sp.application_id == args.app_service_principal,
            "oauth_secret_count": len(secrets),
            "oldest_secret_created": min(created) if created else "",
            "latest_secret_expires": max(expiry) if expiry else "",
        })
    write_rows(spark, args.catalog, args.schema, "access_service_principals", rows,
               "display_name string, application_id string, active boolean, roles string, entitlements string, "
               "is_app_service_principal boolean, oauth_secret_count int, oldest_secret_created string, latest_secret_expires string")

# COMMAND ----------

list_service_principals(args, spark)
