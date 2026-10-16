# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Ask after the semantic layer
# MAGIC
# MAGIC Updates the enhanced Genie space in place by title. It covers the metric view and adds instructions, sample questions and an example query. The notebook asks the same questions as `02_ask_before` and replaces this stage's rows in `ontology_comparison`. Run `03_add_semantics` first.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ontology", ['catalog', 'schema', 'use_case', 'warehouse_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
base = f"{catalog}.{schema}"

from genie_lib import load_spec
spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from genie_lib import GenieClient, register_space
from ask_questions import stage_space, ask_all, write_answers

STAGE = "enhanced"
run_id = params["run_id"]
client = GenieClient(WorkspaceClient())

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create or update the space

# COMMAND ----------

title, serialized = stage_space(spec, catalog, schema, STAGE)
space_id = client.upsert_space(title, spec["genie"]["description"], params["warehouse_id"], serialized)
url = client.space_url(space_id)
print(f"Genie space {title}: {space_id}\n{url}")
register_space(spark, base, "genie_spaces", (run_id, "ontology", STAGE, space_id, url, title, datetime.now(timezone.utc).isoformat()))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Ask every question and compare with the expected rows

# COMMAND ----------

rows_out = ask_all(spark, client, space_id, spec, catalog, schema, STAGE, run_id)
write_answers(spark, base, STAGE, rows_out)
displayHTML(f'<a href="{url}">Open the {STAGE} space</a>')
