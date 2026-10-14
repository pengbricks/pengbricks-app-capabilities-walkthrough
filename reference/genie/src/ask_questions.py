"""Create a Genie space for one stage and ask it every question in the spec, recording SQL and whether it matches.

--stage baseline  space over the raw tables only: no comments, no metric view, no instructions
--stage enhanced  space over the metric view, with instructions, sample questions, and an example query
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

from genie_lib import GenieClient, answer_parts, build_serialized_space, fill, load_spec, rows_match, run_sql_rows

COMPARISON_TABLE = "ontology_comparison"
SPACES_TABLE = "genie_spaces"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--warehouse-id", required=True)
    parser.add_argument("--stage", choices=["baseline", "enhanced"], required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import spark

    spec = load_spec(args.use_case_file)
    genie_spec = spec["genie"]
    base = f"{args.catalog}.{args.schema}"
    client = GenieClient(WorkspaceClient())

    if args.stage == "baseline":
        identifiers = [f"{base}.{table['name']}" for table in spec["tables"]]
        serialized = build_serialized_space(identifiers)
    else:
        identifiers = [f"{base}.{spec['metric_view']['name']}"]
        serialized = build_serialized_space(
            identifiers,
            instructions=genie_spec["instructions"].strip(),
            sample_questions=genie_spec["sample_questions"],
            example_sql=[(item["question"], fill(item["sql"], args.catalog, args.schema)) for item in genie_spec["example_sql"]],
        )
    title = f"{spec['space_prefix']} ({args.stage}) [{args.schema}]"
    space_id = client.create_space(title, genie_spec["description"], args.warehouse_id, serialized)
    url = client.space_url(space_id)
    print(f"Created Genie space {title}: {space_id}\n{url}")

    now = datetime.now(timezone.utc).isoformat()
    spark.createDataFrame(
        [(args.run_id, "ontology", args.stage, space_id, url, title, now)],
        "run_id string, guide string, role string, space_id string, url string, title string, created_at string",
    ).write.mode("append").saveAsTable(f"{base}.{SPACES_TABLE}")

    rows_out = []
    for question in spec["questions"]:
        expected_sql = fill(question["expected_sql"], args.catalog, args.schema)
        expected = run_sql_rows(spark, expected_sql)
        message = client.ask(space_id, question["text"])
        sql, text = answer_parts(message)
        got, note = [], ""
        if sql:
            try:
                got = run_sql_rows(spark, sql)
            except Exception as error:
                note = f"Generated SQL failed: {str(error)[:200]}"
        else:
            note = f"No SQL. {text[:200]}"
        matches = bool(sql) and not note and rows_match(expected, got)
        rows_out.append(
            (
                args.run_id, question["id"], args.stage, question["text"], message.get("status"), sql or "",
                expected_sql.strip(), matches, json.dumps([[str(c) for c in r] for r in got[:20]]),
                json.dumps([[str(c) for c in r] for r in expected[:20]]), note, message.get("latency_s"), now,
            )
        )
        print(f"[{args.stage}] {question['id']}: match={matches}")

    spark.createDataFrame(
        rows_out,
        "run_id string, question_id string, stage string, question string, status string, genie_sql string, expected_sql string, "
        "matches_expected boolean, genie_rows string, expected_rows string, note string, latency_s double, asked_at string",
    ).write.mode("append").saveAsTable(f"{base}.{COMPARISON_TABLE}")


if __name__ == "__main__":
    main()
