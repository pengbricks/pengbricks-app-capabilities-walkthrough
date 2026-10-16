# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Run the user session
# MAGIC
# MAGIC Updates the assistant Genie space in place by title, then plays the scripted session through the Conversation API. Each task goes to `ux_session_log` with its outcome, any issue found, and the training need from the spec. The log keeps one set of rows per `run_id`, so a rerun with the same `run_id` replaces its own rows. The notebook fails if a task does not complete.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_genie_ux", ['catalog', 'schema', 'use_case', 'warehouse_id', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
base = f"{catalog}.{schema}"

from genie_lib import load_spec
spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from genie_lib import GenieClient, register_space, answer_parts, build_serialized_space, fill, find_issues, rows_match, run_sql_rows

run_id = params["run_id"]
genie_spec, script = spec["genie"], spec["ux_script"]
client = GenieClient(WorkspaceClient())

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create or update the assistant space

# COMMAND ----------

serialized = build_serialized_space(
    [f"{base}.{spec['metric_view']['name']}"],
    instructions=genie_spec["instructions"].strip(),
    sample_questions=genie_spec["sample_questions"],
    example_sql=[(item["question"], fill(item["sql"], catalog, schema)) for item in genie_spec["example_sql"]],
)
title = f"{spec['space_prefix']} (assistant) [{schema}]"
space_id = client.upsert_space(title, genie_spec["description"], params["warehouse_id"], serialized)
url = client.space_url(space_id)
print(f"Genie space {title}: {space_id}\n{url}")
now = datetime.now(timezone.utc).isoformat()
register_space(spark, base, "genie_spaces", (run_id, "user-experience", "assistant", space_id, url, title, now))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Play the scripted session
# MAGIC
# MAGIC Each step is a user task: a question in a new or existing conversation, or a thumbs rating on an earlier answer. Answers are checked against the expected SQL where the spec gives one, and `find_issues` flags problems such as slow answers or missing SQL.

# COMMAND ----------

LOG_SCHEMA = (
    "run_id string, step int, step_id string, task_type string, prompt string, conversation_id string, message_id string, "
    "status string, outcome string, generated_sql string, response_text string, latency_s double, matches_expected boolean, "
    "feedback_rating string, issue string, training_need string, logged_at string"
)
done: dict[str, dict] = {}
log = []
conversation_id = None
for number, step in enumerate(script["steps"], start=1):
    if step["task_type"] == "feedback":
        target = done[step["target"]]
        rating = "POSITIVE" if target["matches"] else "NEGATIVE"
        status = client.feedback(space_id, target["conversation_id"], target["message_id"], rating)
        issue = "" if status == "ok" else f"Feedback call failed: {status}"
        log.append((
            run_id, number, step["id"], "feedback", f"Thumbs {'up' if rating == 'POSITIVE' else 'down'} on '{step['target']}'",
            target["conversation_id"], target["message_id"], "SENT" if status == "ok" else "ERROR",
            f"Rating {rating} recorded" if status == "ok" else status, "", "", None, None, rating, issue,
            "Tell users thumbs ratings go to the space owner and show up in monitoring." if not issue else "", now,
        ))
        print(f"{step['id']}: {rating} -> {status}")
        continue

    if step.get("new_conversation") or step["task_type"] == "discovery":
        conversation_id = None
    message = client.ask(space_id, step["prompt"], conversation_id)
    conversation_id = message["conversation_id"]
    sql, text = answer_parts(message)
    expected_rows = matches = None
    if step.get("expected_sql") and sql:
        try:
            expected_rows = run_sql_rows(spark, fill(step["expected_sql"], catalog, schema))
            matches = rows_match(expected_rows, run_sql_rows(spark, sql))
        except Exception as error:
            text += f" [could not run generated SQL: {str(error)[:150]}]"
            matches = False
    elif step.get("expected_sql"):
        matches = False
    issues = find_issues(
        message.get("status", ""), bool(sql), matches, message["latency_s"], script["latency_warn_seconds"],
        ambiguous=bool(step.get("ambiguous")), expects_sql=step["task_type"] not in {"discovery"} and not step.get("ambiguous"),
        response_text=text,
    )
    outcome = (
        "Answered, matches expected result" if matches
        else "Answered, differs from expected result" if matches is False
        else "Answered" if message.get("status") == "COMPLETED"
        else f"Not answered ({message.get('status')})"
    )
    done[step["id"]] = {"conversation_id": conversation_id, "message_id": message["message_id"], "matches": bool(matches)}
    log.append((
        run_id, number, step["id"], step["task_type"], step["prompt"], conversation_id, message["message_id"],
        message.get("status"), outcome, sql or "", text[:2000], message["latency_s"], matches, "",
        "; ".join(issues), step["training_need"], now,
    ))
    print(f"{step['id']}: {outcome}; issues={issues}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the log

# COMMAND ----------

spark.sql(f"CREATE TABLE IF NOT EXISTS {base}.ux_session_log ({LOG_SCHEMA})")
spark.sql(f"DELETE FROM {base}.ux_session_log WHERE run_id = '{run_id}'")
spark.createDataFrame(log, LOG_SCHEMA).write.mode("append").saveAsTable(f"{base}.ux_session_log")
failed = [row for row in log if row[7] in {"FAILED", "CANCELLED", "TIMEOUT"}]
if failed:
    raise RuntimeError(f"{len(failed)} task(s) did not complete")
displayHTML(f'<a href="{url}">Open the assistant space</a>')
