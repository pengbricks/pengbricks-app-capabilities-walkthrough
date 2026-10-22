# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Policies
# MAGIC
# MAGIC Looks for a serverless budget policy by name, creates it if the API allows, then creates the cluster policy or edits it only if its definition drifted.
# MAGIC
# MAGIC Each row is written to `admin_actions` with a merge keyed on the run, category, action and target, so a retried or repeated task updates its own rows. Safe to rerun: the budget policy is reused if it exists, and the cluster policy is edited only when its definition has drifted.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_platform_admin", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

import json
from admin_lib import is_owned_name

from admin_lib import LEDGER_DDL, action, record, load_admin_spec
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import DatabricksError

dbutils.widgets.text("run_id", "")
from datetime import datetime, timezone
# In the job, run_id is the job run. Standalone, a blank widget uses one id per day, so a rerun updates its own rows.
run_id = dbutils.widgets.get("run_id").strip() or datetime.now(timezone.utc).strftime("manual-%Y%m%d")
spec = load_admin_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
table = f"{params['catalog']}.{params['schema']}.admin_actions"
catalog, schema = params["catalog"], params["schema"]
w = WorkspaceClient()
spark.sql(LEDGER_DDL.format(table=table))

# COMMAND ----------

# MAGIC %md
# MAGIC ## The task

# COMMAND ----------

def policies(w, spark, spec, **_):
    rows = []
    # 1) Serverless budget policy
    name = spec["budget_policy_name"]
    assert is_owned_name(name)
    try:
        # Budget policies are managed through the account-level API. Probe the workspace-level path first.
        listing = w.api_client.do("GET", "/api/2.1/budget-policies")
        found = [p for p in listing.get("policies", []) if p.get("policy_name") == name]
        if found:
            rows.append(action("policy", "budget_policy", name, "unchanged", f"policy id {found[0].get('policy_id')}"))
        else:
            body = {"policy": {"policy_name": name, "custom_tags": spec["budget_policy_tags"]}}
            created = w.api_client.do("POST", "/api/2.1/budget-policies", body=body)
            rows.append(action("policy", "budget_policy", name, "created", f"policy id {created.get('policy_id')}"))
    except Exception as e:  # noqa: BLE001 - record whatever the workspace says
        rows.append(action("policy", "budget_policy", name, "not_allowed", f"{type(e).__name__}: {e}; applying a cluster policy instead"))
    # 2) Cluster policy
    cname = spec["cluster_policy_name"]
    assert is_owned_name(cname)
    import json

    try:
        definition = json.dumps(spec["cluster_policy_definition"], sort_keys=True)
        found = [p for p in w.cluster_policies.list() if p.name == cname]
        if found:
            if json.loads(found[0].definition or "{}") != json.loads(definition):
                w.cluster_policies.edit(policy_id=found[0].policy_id, name=cname, definition=definition)
                rows.append(action("policy", "cluster_policy", cname, "changed", f"definition updated on {found[0].policy_id}"))
            else:
                rows.append(action("policy", "cluster_policy", cname, "unchanged", f"policy id {found[0].policy_id}"))
        else:
            created = w.cluster_policies.create(name=cname, definition=definition)
            rows.append(action("policy", "cluster_policy", cname, "created", f"policy id {created.policy_id}"))
    except Exception as e:  # noqa: BLE001
        rows.append(action("policy", "cluster_policy", cname, "not_allowed", f"{type(e).__name__}: {e}"))
    return rows

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it and record the result

# COMMAND ----------

rows = policies(w, spark, spec)
record(spark, table, run_id, rows)
for r in rows:
    print(f"[{r['status']}] {r['category']}/{r['action']} {r['target']}: {r['detail']}")
