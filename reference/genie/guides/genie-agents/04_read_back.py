# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Read the conversations back
# MAGIC
# MAGIC Lists the conversations, lists each one's messages, reads every message, and reads one query result, then records the field names the platform stores (never the values). The recorded fields answer "what does Genie keep": the question, the generated SQL and its description, the statement ID, timestamps, status, feedback, and a handle to the result.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_genie_agents", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]
base = f"{catalog}.{schema}"

from databricks.sdk import WorkspaceClient
from genie_lib import GenieClient, field_paths
from agent_results import GUIDE, group_paths, read_step, result_row, write_step

client = GenieClient(WorkspaceClient())
space_id = spark.sql(f"SELECT space_id FROM {base}.genie_spaces WHERE guide = '{GUIDE}' AND role = 'agent'").first()["space_id"]
asked = [row for row in read_step(spark, base, "ask") if row["conversation_id"]]
conversations = sorted({row["conversation_id"] for row in asked})
print(f"{len(asked)} messages in {len(conversations)} conversations")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Conversations and messages

# COMMAND ----------

rows = []
listed = [c for c in client.list_conversations(space_id) if c.get("conversation_id") in conversations]
conversation_paths = [path for c in listed for path in field_paths(c)]
message_paths = []
for conversation_id in conversations:
    messages = client.list_messages(space_id, conversation_id)
    rows.append(result_row(run_id, "stored", "messages_in_conversation", len(messages), "GET .../conversations/{id}/messages", conversation_id))
    for listed_message in messages:
        message_paths += field_paths(client.get_message(space_id, conversation_id, listed_message["message_id"]))

rows.append(result_row(run_id, "stored", "conversation.fields", ", ".join(sorted(set(conversation_paths))), "GET .../conversations (the list call; there is no single-conversation read)"))
for root, paths in group_paths(message_paths).items():
    rows.append(result_row(run_id, "stored", f"message.{root}", ", ".join(paths), "fields of a message returned by GET .../messages/{id}"))
    print(f"message.{root}: {', '.join(paths)}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Feedback and the query result handle

# COMMAND ----------

first = asked[0]
message = client.get_message(space_id, first["conversation_id"], first["message_id"])
rows.append(result_row(run_id, "stored", "feedback_stored", (message.get("feedback") or {}).get("rating", "none"), "feedback.rating on the first message, set in task 3", first["conversation_id"], first["message_id"]))

attachment = next((a for a in message.get("attachments") or [] if a.get("query")), None)
if attachment:
    result = client.get_query_result(space_id, first["conversation_id"], first["message_id"], attachment["attachment_id"])
    rows.append(result_row(run_id, "stored", "query_result.fields", ", ".join(field_paths(result)), "GET .../attachments/{id}/query-result; results stay in the platform for seven days"))
    rows.append(result_row(run_id, "stored", "query_result.row_count", (attachment["query"].get("query_result_metadata") or {}).get("row_count"), "row count recorded on the attachment"))
    print("query_result fields:", field_paths(result))
write_step(spark, base, "stored", rows)
