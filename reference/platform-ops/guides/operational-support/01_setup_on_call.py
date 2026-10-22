# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Set up the on-call table
# MAGIC
# MAGIC Overwrites `on_call` from the spec, so the table always matches the committed ownership map, and makes sure `support_incidents` exists. Rerunning replaces the table with the same rows.
# MAGIC
# MAGIC Safe to rerun: `on_call` is overwritten and `support_incidents` is created only if missing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_operational_support", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

from support_lib import load_support_spec
spec = load_support_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
catalog, schema = params["catalog"], params["schema"]
from support_lib import INCIDENTS_DDL, ON_CALL_COLUMNS

# COMMAND ----------

# MAGIC %md
# MAGIC ## The task

# COMMAND ----------

def setup_on_call(spark, spec, catalog, schema, **_):
    """Overwrite on_call from the spec, so the table always matches the committed ownership map."""
    cols = ["tag_key", "tag_value", "owner_team", "owner_contact", "escalation_contact", "escalate_after_minutes"]
    rows = [tuple(r[c] for c in cols) for r in spec["on_call"]]
    spark.createDataFrame(rows, ON_CALL_COLUMNS).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{catalog}.{schema}.on_call")
    spark.sql(f"COMMENT ON TABLE {catalog}.{schema}.on_call IS 'Maps job tags to owner and escalation contacts; read by the triage task'")
    spark.sql(INCIDENTS_DDL.format(table=f"{catalog}.{schema}.support_incidents"))
    print(f"on_call: {len(rows)} rows")

# COMMAND ----------

setup_on_call(spark, spec, catalog, schema)
