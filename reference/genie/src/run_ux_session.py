"""Create the assistant space and run the scripted user session through the Conversation API.

Each task is logged to ux_session_log with its outcome, any issue found, and the training need from the spec.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from genie_lib import GenieClient, answer_parts, build_serialized_space, fill, find_issues, load_spec, rows_match, run_sql_rows

LOG_SCHEMA = (
    "run_id string, step int, step_id string, task_type string, prompt string, conversation_id string, message_id string, "
    "status string, outcome string, generated_sql string, response_text string, latency_s double, matches_expected boolean, "
    "feedback_rating string, issue string, training_need string, logged_at string"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--warehouse-id", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark

    spec = load_spec(args.use_case_file)
    genie_spec, script = spec["genie"], spec["ux_script"]
    base = f"{args.catalog}.{args.schema}"
    client = GenieClient(WorkspaceClient())

    serialized = build_serialized_space(
        [f"{base}.{spec['metric_view']['name']}"],
        instructions=genie_spec["instructions"].strip(),
        sample_questions=genie_spec["sample_questions"],
        example_sql=[(item["question"], fill(item["sql"], args.catalog, args.schema)) for item in genie_spec["example_sql"]],
    )
    title = f"{spec['space_prefix']} (assistant) [{args.schema}]"
    space_id = client.create_space(title, genie_spec["description"], args.warehouse_id, serialized)
    url = client.space_url(space_id)
    print(f"Created Genie space {title}: {space_id}\n{url}")
    now = datetime.now(timezone.utc).isoformat()
    spark.createDataFrame(
        [(args.run_id, "user-experience", "assistant", space_id, url, title, now)],
        "run_id string, guide string, role string, space_id string, url string, title string, created_at string",
    ).write.mode("append").saveAsTable(f"{base}.genie_spaces")

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
                args.run_id, number, step["id"], "feedback", f"Thumbs {'up' if rating == 'POSITIVE' else 'down'} on '{step['target']}'",
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
                expected_rows = run_sql_rows(spark, fill(step["expected_sql"], args.catalog, args.schema))
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
            args.run_id, number, step["id"], step["task_type"], step["prompt"], conversation_id, message["message_id"],
            message.get("status"), outcome, sql or "", text[:2000], message["latency_s"], matches, "",
            "; ".join(issues), step["training_need"], now,
        ))
        print(f"{step['id']}: {outcome}; issues={issues}")

    spark.createDataFrame(log, LOG_SCHEMA).write.mode("append").saveAsTable(f"{base}.ux_session_log")
    failed = [row for row in log if row[7] in {"FAILED", "CANCELLED", "TIMEOUT"}]
    if failed:
        raise RuntimeError(f"{len(failed)} task(s) did not complete")


if __name__ == "__main__":
    main()
