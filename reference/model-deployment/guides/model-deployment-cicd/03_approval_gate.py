# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Approval gate
# MAGIC
# MAGIC Promotes `@challenger` to `@champion` only when an approval exists. Approval sources, in order:
# MAGIC 1. the `approved_by` job parameter (CI passes the GitHub actor after the environment approval);
# MAGIC 2. a row in `model_approvals` for this model version with status `approved`.
# MAGIC
# MAGIC With no approval the notebook prints why, sets `promoted=false`, and finishes successfully. Safe to rerun: the `champion` alias is set, not added.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_release", ['catalog', 'schema', 'use_case', 'champion_alias', 'challenger_alias'])
dbutils.widgets.text("approved_by", "")
dbutils.widgets.text("model_version", "")
approved_by = dbutils.widgets.get("approved_by").strip()

import common
import mlflow
from mlflow.tracking import MlflowClient

catalog, schema = params["catalog"], params["schema"]
spec = common.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
model_name = common.full_model_name(catalog, schema, spec)
mlflow.set_registry_uri("databricks-uc")
client = MlflowClient(registry_uri="databricks-uc")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the challenger and look for an approver
# MAGIC
# MAGIC In the job, the version comes from `train_and_register`. Standalone, a blank widget takes the version `@challenger` points to.

# COMMAND ----------

challenger = client.get_model_version_by_alias(model_name, params["challenger_alias"])
model_version = dbutils.widgets.get("model_version").strip() or str(challenger.version)
if str(challenger.version) != model_version:
    raise Exception(f"@{params['challenger_alias']} is version {challenger.version}, expected {model_version}")


def table_approver(table: str, model: str, version: str) -> str:
    if not spark.catalog.tableExists(table):
        return ""
    rows = spark.sql(
        f"SELECT approved_by FROM {table} WHERE model_name = '{model}' "
        f"AND model_version = '{version}' AND status = 'approved' "
        f"ORDER BY approved_at DESC LIMIT 1"
    ).collect()
    return rows[0]["approved_by"] if rows else ""


approver = approved_by or table_approver(f"{catalog}.{schema}.model_approvals", model_name, model_version)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Promote or stop

# COMMAND ----------

if not approver:
    print(
        f"No approval for version {model_version}. Stopping at the gate: "
        f"@{params['challenger_alias']} stays, @{params['champion_alias']} is unchanged. "
        "Re-run with approved_by=<name> or add an 'approved' row to model_approvals."
    )
    dbutils.jobs.taskValues.set(key="promoted", value="false")
else:
    client.set_registered_model_alias(model_name, params["champion_alias"], model_version)
    client.set_model_version_tag(model_name, model_version, "approved_by", approver)
    dbutils.jobs.taskValues.set(key="promoted", value="true")
    print(f"{approver} approved version {model_version}: @{params['champion_alias']} now points to it")
