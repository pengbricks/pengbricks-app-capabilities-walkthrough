# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Prepare the tool
# MAGIC
# MAGIC Creates the sample orders table, the email mask, and the Unity Catalog function that the agents call as a tool. The agent calls this function; Unity Catalog grants decide what it can touch. Reruns overwrite the table and replace the function and mask, so the row count stays the same.
# MAGIC
# MAGIC Safe to rerun: the table is overwritten and the function and mask are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_agent_build", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

import agents_common as ac
import tool_setup

spec = ac.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
fn, rows = tool_setup.prepare_tool(spark, spec, params["catalog"], params["schema"])
dbutils.jobs.taskValues.set(key="function", value=fn)
dbutils.jobs.taskValues.set(key="rows", value=rows)
