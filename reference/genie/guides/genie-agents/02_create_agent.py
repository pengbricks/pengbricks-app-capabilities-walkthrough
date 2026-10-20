# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Create or update the agent
# MAGIC
# MAGIC Builds the agent definition from the spec's `genie_agent` block and sends it through the REST API: `POST /api/2.0/genie/spaces` the first time, `PATCH` on every later run. The title identifies the agent, so a rerun updates it in place and deletes any duplicate with the same title. The notebook then reads the stored definition back and records what it holds, plus the type of the SQL warehouse the agent is attached to.
# MAGIC
# MAGIC This guide uses the REST helper and not a `genie_spaces` bundle resource because the agent needs the metric view that task 1 creates, and a bundle deploy creates the agent before any task runs. The README shows the bundle resource for a team whose data already exists.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_genie_agents", ['catalog', 'schema', 'use_case', 'warehouse_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]
base = f"{catalog}.{schema}"

from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from genie_lib import GenieClient, build_agent_space, definition_summary, load_spec, register_space
from agent_results import GUIDE, result_row, write_step

spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
agent = spec["genie_agent"]
w = WorkspaceClient()
client = GenieClient(w)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create or update the agent

# COMMAND ----------

serialized = build_agent_space(agent, catalog, schema)
title = f"{spec['space_prefix']} ({agent['title_suffix']}) [{schema}]"
space_id = client.upsert_space(title, agent["description"], params["warehouse_id"], serialized)
url = client.space_url(space_id)
print(f"Genie Agent {title}: {space_id}\n{url}")
register_space(spark, base, "genie_spaces", (run_id, GUIDE, "agent", space_id, url, title, datetime.now(timezone.utc).isoformat()))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the stored definition back

# COMMAND ----------

stored = client.get_space(space_id)
summary = definition_summary(stored["serialized_space"])
rows = [result_row(run_id, "definition", "space_id", space_id, url)]
rows += [result_row(run_id, "definition", name, count) for name, count in summary.items()]
rows.append(result_row(run_id, "definition", "space_fields", ", ".join(sorted(stored.keys())), "fields the agent object returns"))
rows.append(result_row(run_id, "definition", "warehouse_id", stored.get("warehouse_id"), "warehouse the agent is attached to"))
for name, count in summary.items():
    print(f"{name}: {count}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the warehouse the agent runs on

# COMMAND ----------

warehouse = w.api_client.do("GET", f"/api/2.0/sql/warehouses/{params['warehouse_id']}")
for key in ["warehouse_type", "enable_serverless_compute", "cluster_size", "min_num_clusters", "max_num_clusters", "auto_stop_mins"]:
    rows.append(result_row(run_id, "definition", f"warehouse.{key}", warehouse.get(key), "SQL warehouse attached to the agent"))
    print(f"warehouse.{key}: {warehouse.get(key)}")
author = w.current_user.me().user_name
rows.append(result_row(run_id, "definition", "author", author, "identity that saved the warehouse selection; its compute credential is embedded in the agent"))
write_step(spark, base, "definition", rows)
displayHTML(f'<a href="{url}">Open the agent</a>')
