# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Triage support tickets
# MAGIC
# MAGIC One query classifies each ticket, scores its sentiment, and writes a short summary, then saves the result to `aif_tickets_triaged`. A second query asks `ai_decide` two questions per ticket: a yes/no probability that the service is down, and an urgency score. The scoring cell compares the category and sentiment with the expected values in the spec and records the accuracy in `aif_results`. Downstream reports read the saved table, so each ticket costs one set of calls.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import aif_lib as a
spec = a.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
triaged = a.fq(catalog, schema, spec["tables"]["tickets"] + "_triaged")

# COMMAND ----------

import json, time

labels = a.sql_string(json.dumps(spec["triage"]["labels"]))
start = time.perf_counter()
spark.sql(f"""
CREATE OR REPLACE TABLE {triaged} AS
SELECT ticket_id, body, expected_category, expected_sentiment,
       ai_classify(body, {labels}, map('version', '2.0')):response[0]::STRING AS category,
       ai_analyze_sentiment(body) AS sentiment,
       ai_summarize(body, {int(spec['triage']['summary_words'])}) AS summary
FROM {T['tickets']}
WHERE body IS NOT NULL
""")
seconds = time.perf_counter() - start
display(spark.table(triaged).select("ticket_id", "category", "expected_category", "sentiment", "expected_sentiment", "summary"))

# COMMAND ----------

rows = spark.table(triaged).collect()
wrong_category = [r.ticket_id for r in rows if (r.category or "").lower() != r.expected_category]
wrong_sentiment = [r.ticket_id for r in rows if (r.sentiment or "").lower() != r.expected_sentiment]
a.write_results(spark, T["results"], "triage", [
    ("tickets", len(rows), ""),
    ("category_accuracy", a.accuracy([(r.expected_category, r.category) for r in rows]), f"wrong: {wrong_category}"),
    ("sentiment_accuracy", a.accuracy([(r.expected_sentiment, r.sentiment) for r in rows]), f"wrong: {wrong_sentiment}"),
    ("seconds", seconds, "classify, sentiment, and summary for every ticket"),
], params["run_id"])

# COMMAND ----------

# MAGIC %md
# MAGIC `ai_decide` is in Beta and needs the AI Decide preview, which a workspace admin turns on in the workspace preview settings. Without it the step records the reason and the job carries on.

# COMMAND ----------

decided = a.fq(catalog, schema, spec["tables"]["tickets"] + "_decided")
d = spec["triage"]["decide"]
questions = a.sql_string(" ".join(d["questions"].split()))
start = time.perf_counter()
try:
    spark.sql(f"""
    CREATE OR REPLACE TABLE {decided} AS
    SELECT ticket_id, body,
           r:response:answers:service_down:probability::DOUBLE AS service_down_probability,
           r:response:answers:urgency:score::DOUBLE AS urgency_score,
           r:error_message::STRING AS decide_error
    FROM (SELECT ticket_id, body, ai_decide(body, {questions}, map('version', '1.0')) AS r FROM {T['tickets']})
    """)
    decide_seconds = time.perf_counter() - start
    rows = spark.table(decided).collect()
    display(spark.table(decided).orderBy("ticket_id"))
    expected = set(d["service_down_ids"])
    flagged = {r.ticket_id for r in rows if (r.service_down_probability or 0) >= 0.5}
    a.write_results(spark, T["results"], "decide", [
        ("service_down_accuracy", a.accuracy([(r.ticket_id in expected, r.ticket_id in flagged) for r in rows]),
         f"flagged: {sorted(flagged)}; expected: {sorted(expected)}"),
        ("errors", sum(1 for r in rows if r.decide_error), ""),
        ("seconds", decide_seconds, "two questions per ticket"),
    ], params["run_id"])
except Exception as exc:  # noqa: BLE001 - the preview is off in some workspaces
    message = str(exc)
    if "not enabled" not in message:
        raise
    a.write_results(spark, T["results"], "decide", [("enabled", 0, message.split("SQLSTATE")[0].strip()[-200:])], params["run_id"])
