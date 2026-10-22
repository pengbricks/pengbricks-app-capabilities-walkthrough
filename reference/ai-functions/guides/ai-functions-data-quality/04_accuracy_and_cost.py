# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Accuracy against the labels, and what it cost
# MAGIC
# MAGIC **Accuracy.** Each check is scored against `aidq_truth`, for the rule verdicts, the AI verdicts, and both together. `fail` is the positive class: precision is the share of `fail` verdicts that were real problems, and recall is the share of real problems that were caught. Rows sent to `review` are counted apart. They are not guesses, so they lower neither number, but a high review share means a person does the work the model was meant to do. A gate compares each check with `thresholds` in `use_cases/data_quality.yml`. The sample is small, so treat one run's numbers as a smoke test and size a real labelled sample from your own data.
# MAGIC
# MAGIC **Cost.** Two estimates. The first is the rows and characters each check sent to a model, with a token count at the spec's `chars_per_token` (a rule of thumb, not a documented figure) and the calls avoided by the rules. The second reads `system.billing.usage` for the identity and time window of notebook 3 and divides by the rows sent. Billing lands hours after the work, so the notebook polls briefly and records a `billing_status` of `complete`, `partial`, or `not_available`. If it is not `complete`, run this notebook again later. Safe to rerun: the step's rows in `aidq_results` and the table `aidq_billing_usage` are replaced. Usage is account wide, so rows from other work by the same identity in the window can mix in.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_functions_data_quality", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]

import json, time
from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
import aif_lib as a
import aidq_lib as q
import docproc_lib as d
spec = q.load_spec(str(bundle_root() / "use_cases" / "data_quality.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
TRUTH_COLUMN = {"reason_code": "truth_reason_bad", "address": "truth_address_bad", "duplicate_company": "truth_duplicate",
                "sensitive_note": "truth_pii", "status_comment": "truth_contradiction"}

# COMMAND ----------

# MAGIC %md
# MAGIC ## Precision and recall per check and source

# COMMAND ----------

scored = spark.sql(f"""
SELECT q.check_name, q.source, q.verdict, CASE q.check_name {' '.join(f"WHEN '{c}' THEN t.{col}" for c, col in TRUTH_COLUMN.items())} END AS truth_bad
FROM {T['quality']} q JOIN {T['truth']} t USING (record_id)""").collect()
table, results, failures = [], [], []
for check in q.CHECKS:
    mine = [r for r in scored if r.check_name == check]
    for source in ("rule", "ai", "both"):
        pairs = [(bool(r.truth_bad), r.verdict) for r in mine if source == "both" or r.source == source]
        if not pairs:
            continue
        m = q.confusion(pairs)
        status = q.gate(m, spec["thresholds"]) if source != "rule" else "ok" if m["precision"] >= 0.99 and m["recall"] >= 0.99 else "rules miss real problems"
        table.append((check, source, int(m["rows"]), int(m["tp"]), int(m["fp"]), int(m["fn"]), int(m["review"]), round(m["precision"], 3), round(m["recall"], 3), status))
        for name in ("precision", "recall", "review_share"):
            results.append((f"{check}.{source}.{name}", m[name], f"{int(m['rows'])} rows; gate: {status}"))
        if status != "ok" and source == "both":
            failures.append(f"{check}: {status}")
display(spark.createDataFrame(table, "check_name string, source string, rows int, true_fail int, false_fail int, missed int, review int, precision double, recall double, gate string"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Extraction accuracy for the address check
# MAGIC
# MAGIC The verdict only needs a postal code. The extracted fields are worth checking field by field, because standardized fields feed a join or a lookup downstream.

# COMMAND ----------

extracted = spark.sql(f"""
SELECT r.record_id, r.raw, t.truth_postal_code, t.truth_state FROM {T['ai_results']} r JOIN {T['truth']} t USING (record_id)
WHERE r.check_name = 'address'""").collect()
postal, state = [], []
for r in extracted:
    values, _ = q.parse_extract(r.raw, ["postal_code", "state"])
    postal.append((r.truth_postal_code, values.get("postal_code")))
    state.append((r.truth_state, values.get("state")))
postal_accuracy, state_accuracy = a.accuracy(postal), a.accuracy(state)
results += [("address.postal_code_accuracy", postal_accuracy, f"{len(extracted)} addresses the rules could not judge"),
            ("address.state_accuracy", state_accuracy, "state code where the truth has one")]
print(f"postal code accuracy {postal_accuracy:.3f}, state accuracy {state_accuracy:.3f} over {len(extracted)} addresses")

# COMMAND ----------

# MAGIC %md
# MAGIC ## What the rules saved, and a token estimate

# COMMAND ----------

total = spark.table(T["records"]).count()
calls = spark.table(T["ai_calls"]).collect()
sent_rows = sum(c.rows_sent for c in calls)
rows_by_check = {c.check_name: c.rows_sent for c in calls}
estimate = []
for c in calls:
    tokens = q.estimate_tokens(c.chars_sent, float(spec["cost"]["chars_per_token"]))
    estimate.append((c.check_name, c.function, c.rows_sent, c.chars_sent, tokens))
    results.append((f"{c.check_name}.input_tokens_estimate", tokens, f"{c.chars_sent} characters at {spec['cost']['chars_per_token']} per token; excludes the prompt, labels, and output"))
display(spark.createDataFrame(estimate, "check_name string, function string, rows_sent long, chars_sent long, input_tokens_estimate long"))
results.append(("rows_sent_to_ai", sent_rows, f"of {total * 4} row-level checks if every row went to a model (duplicate pairs counted as rows sent)"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Billed usage

# COMMAND ----------

spark.conf.set("spark.sql.session.timeZone", "UTC")
workspace_id = WorkspaceClient().get_workspace_id()
identity = spark.sql("SELECT current_user()").first()[0]
window_start = min(c.started_at for c in calls)
window_end = max(c.ended_at for c in calls)

def read_usage():
    return spark.sql(f"""
    SELECT u.billing_origin_product AS product, u.sku_name, u.usage_unit,
           coalesce(u.product_features.ai_functions.ai_function, '') AS ai_function, u.usage_start_time, u.usage_end_time,
           u.usage_quantity AS quantity, u.usage_quantity * p.pricing.effective_list.default AS list_usd
    FROM system.billing.usage u
    LEFT JOIN system.billing.list_prices p
      ON u.cloud = p.cloud AND u.sku_name = p.sku_name AND u.usage_unit = p.usage_unit
     AND u.usage_end_time >= p.price_start_time AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)
     AND p.currency_code = 'USD'
    WHERE u.workspace_id = '{workspace_id}' AND u.identity_metadata.run_as = {a.sql_string(identity)}
      AND u.usage_date BETWEEN date('{window_start:%Y-%m-%d}') AND date('{window_end:%Y-%m-%d}')
      AND u.usage_start_time < timestamp('{window_end:%Y-%m-%d %H:%M:%S}') AND u.usage_end_time > timestamp('{window_start:%Y-%m-%d %H:%M:%S}')
      AND u.billing_origin_product IN ('AI_FUNCTIONS', 'MODEL_SERVING')""")

status, usage, mark = "not_available", [], None
try:
    deadline = time.time() + int(spec["cost"]["poll_minutes"]) * 60
    while True:
        usage = read_usage().collect()
        mark = spark.sql(f"SELECT max(usage_end_time) FROM system.billing.usage WHERE workspace_id = '{workspace_id}' AND usage_date >= date('{window_start:%Y-%m-%d}')").first()[0]
        status = d.billing_status(len(usage), mark, window_end)
        print(f"{datetime.now(timezone.utc):%H:%M:%S} {len(usage)} usage rows, status {status}")
        if status == "complete" or time.time() >= deadline:
            break
        time.sleep(int(spec["cost"]["poll_seconds"]))
    read_usage().write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(T["billing"])
    display(spark.sql(f"""SELECT product, CASE WHEN ai_function = '' THEN sku_name ELSE ai_function END AS source, usage_unit,
        count(*) AS records, round(sum(quantity), 4) AS quantity, round(sum(list_usd), 4) AS list_usd FROM {T['billing']} GROUP BY ALL ORDER BY product, source"""))
except Exception as error:  # no access to system.billing, or the schema is not enabled
    print(f"Could not read system.billing.usage: {error}")

dbu = sum(float(u.quantity or 0) for u in usage) if usage else None
usd = sum(float(u.list_usd or 0) for u in usage) if usage else None
per_k_dbu, per_k_usd = q.per_thousand(dbu, sent_rows), q.per_thousand(usd, sent_rows)
results += [
    ("billing_status", {"complete": 2.0, "partial": 1.0, "not_available": 0.0}[status], f"{status}: {len(usage)} usage rows; run again later if not complete"),
    ("dbu_total", -1.0 if dbu is None else dbu, "AI_FUNCTIONS plus MODEL_SERVING in the notebook 3 window; -1 means no usage yet"),
    ("dbu_per_1000_rows_sent", -1.0 if per_k_dbu is None else per_k_dbu, f"{sent_rows} rows sent to AI; -1 means no usage yet"),
    ("list_usd_per_1000_rows_sent", -1.0 if per_k_usd is None else per_k_usd, "list price, not a contract rate; -1 means no usage yet"),
]

# COMMAND ----------

a.write_results(spark, T["results"], "accuracy_cost", results, run_id)
if failures:
    print("Checks below the gates:", "; ".join(failures))
else:
    print("Every check meets the precision, recall, and review gates.")
