# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Ask questions through the Conversation API
# MAGIC
# MAGIC Deletes the conversations this user started in the agent on earlier runs, so the agent does not collect one set per run, then asks the questions in the spec's `genie_agent.ask` list: a question, a follow-up in the same conversation, a second question in a new conversation, and a vague one the instruction says to answer with a clarifying question. Answers with an expected query are compared by rows. The first answer gets a thumbs-up. Each answer is recorded in `genie_agents_results` with its conversation and message IDs, which the next task reads back.
# MAGIC
# MAGIC Safe to rerun: earlier conversations are deleted first, and the step's rows in `genie_agents_results` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_genie_agents", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]
base = f"{catalog}.{schema}"

import json
from datetime import datetime, timedelta, timezone
from databricks.sdk import WorkspaceClient
from genie_lib import GenieClient, answer_parts, fill, load_spec, rows_match, run_sql_rows
from agent_results import GUIDE, result_row, write_step

spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
client = GenieClient(WorkspaceClient())
space_id = spark.sql(f"SELECT space_id FROM {base}.genie_spaces WHERE guide = '{GUIDE}' AND role = 'agent'").first()["space_id"]
print("agent", space_id)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Clear this user's earlier conversations

# COMMAND ----------

old = client.list_conversation_ids(space_id)
for conversation_id in old:
    client.delete_conversation(space_id, conversation_id)
print(f"Deleted {len(old)} earlier conversation(s)")
rows = [result_row(run_id, "ask", "earlier_conversations_deleted", len(old), "DELETE /conversations/{id}, so reruns do not pile up conversations")]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Ask

# COMMAND ----------

started = datetime.now(timezone.utc) - timedelta(seconds=30)  # margin for clock skew when matching query history
rows.append(result_row(run_id, "ask", "window_start", started.isoformat(), "query history is searched from here"))
conversation_id, first_message = None, None
answers = []
for question in spec["genie_agent"]["ask"]:
    if not question.get("follow_up"):
        conversation_id = None
    message = client.ask(space_id, question["text"], conversation_id)
    conversation_id = message["conversation_id"]
    sql, text = answer_parts(message)
    matches = None
    if question.get("expected_sql") and sql:
        try:
            matches = rows_match(run_sql_rows(spark, fill(question["expected_sql"], catalog, schema)), run_sql_rows(spark, sql))
        except Exception as error:
            text += f" [could not run generated SQL: {str(error)[:150]}]"
            matches = False
    elif question.get("expected_sql"):
        matches = False
    asked_back = (not sql) and message.get("status") == "COMPLETED" and "?" in text
    detail = {"latency_s": message["latency_s"], "has_sql": bool(sql), "matches_expected": matches}
    if question.get("expect_clarification"):
        detail["asked_clarifying_question"] = asked_back
    rows.append(result_row(run_id, "ask", question["id"], message.get("status"), json.dumps(detail), conversation_id, message["message_id"]))
    answers.append((question, message, sql, matches, asked_back))
    print(f"{question['id']}: {message.get('status')} {detail}")
    if first_message is None:
        first_message = (conversation_id, message["message_id"], matches)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Rate the first answer
# MAGIC
# MAGIC Feedback is stored with the message. It does not change the agent: an author reads it on the Monitor tab and turns it into context.

# COMMAND ----------

if first_message and first_message[2]:
    outcome = client.feedback(space_id, first_message[0], first_message[1], "POSITIVE")
else:
    outcome = "skipped: the first answer did not match the expected rows"
rows.append(result_row(run_id, "ask", "feedback_on_first_answer", outcome, "POST .../messages/{id}/feedback with rating POSITIVE", first_message[0], first_message[1]))
print("feedback:", outcome)
write_step(spark, base, "ask", rows)

failed = [q["id"] for q, message, *_ in answers if message.get("status") in {"FAILED", "CANCELLED", "TIMEOUT"}]
if failed:
    raise RuntimeError(f"Questions did not complete: {failed}")
