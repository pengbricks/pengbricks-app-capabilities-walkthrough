# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. Validate, quarantine, and mask
# MAGIC
# MAGIC **Pattern: validate, quarantine, and human review.** Each document's extracted fields pass or fail a set of checks: required fields are not null, every confidence is at or above the spec's threshold (0.8), dates are real `YYYY-MM-DD` dates, and amounts are positive and below a ceiling. Passing documents go to `dp_documents_validated`. The rest go to `dp_documents_quarantine` with the reasons and a `review_status` of `pending`. That table is what a reviewer queue (a Databricks App on Lakebase, or a dashboard) reads. Documents on the `review` route and documents whose parse failed are quarantined the same way.
# MAGIC
# MAGIC Two sample documents are built to fail: an invoice with no total and a form with no date. The notebook checks that quarantine catches them and reports any it misses and any good document it holds back. A third, a faint and tilted receipt, tests OCR; it is not meant to fail.
# MAGIC
# MAGIC **Pattern: mask personal data before sharing.** `ai_mask` hides names, emails, and phone numbers in the parsed text of the forms and letters. The masked copy, `dp_documents_masked`, is what other teams get access to. The notebook checks that none of the planted values survive.
# MAGIC
# MAGIC Safe to rerun: all three tables and the step's rows in `dp_results` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_document_processing", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]

import json
from datetime import datetime, timezone
import aif_lib as a
import docproc_lib as d
spec = d.load_spec(str(bundle_root() / "use_cases" / "documents.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}

# COMMAND ----------

# MAGIC %md
# MAGIC ## Validate

# COMMAND ----------

started = datetime.now(timezone.utc)
fields = {}
for r in spark.table(T["extracted"]).collect():
    fields.setdefault(r.file_name, {})[r.field] = (r.value, r.confidence)
classified = {r.file_name: r for r in spark.table(T["classified"]).collect()}
parsed = {r.file_name: r for r in spark.table(T["parsed"]).select("file_name", "parse_errors").collect()}
truth = {r.file_name: r for r in spark.table(T["truth"]).collect()}

passed, held = [], []
for file_name in sorted(truth):
    c = classified.get(file_name)
    if parsed[file_name].parse_errors:
        held.append((file_name, None, "parse failed", {}))
    elif c is None or c.route == "review":
        held.append((file_name, c.predicted_type if c else None, f"classification confidence {c.confidence if c else 'n/a'} is below the threshold or the call failed", {}))
    else:
        reasons = d.validate_fields(c.route, fields.get(file_name, {}), spec)
        values = {name: v for name, (v, _) in fields.get(file_name, {}).items()}
        confidences = [conf for _, conf in fields.get(file_name, {}).values() if conf is not None]
        (held if reasons else passed).append((file_name, c.route, "; ".join(reasons), values, min(confidences) if confidences else None))

now = datetime.now(timezone.utc)
spark.createDataFrame([(f, t, json.dumps(v), m) for f, t, _, v, m in passed],
                      "file_name string, doc_type string, fields string, min_confidence double").write.mode("overwrite").saveAsTable(T["validated"])
spark.createDataFrame([(h[0], h[1], h[2], json.dumps(h[3]), "pending", now) for h in held],
                      "file_name string, doc_type string, reasons string, fields string, review_status string, quarantined_at timestamp").write.mode("overwrite").saveAsTable(T["quarantine"])
display(spark.table(T["quarantine"]))

# COMMAND ----------

should_hold = {f for f, t in truth.items() if t.expect_quarantine}
held_names = {h[0] for h in held}
missed = sorted(should_hold - held_names)
extra = sorted(held_names - should_hold)
print(f"{len(passed)} validated, {len(held)} quarantined; planned to fail: {sorted(should_hold)}; missed: {missed}; good documents held back: {extra}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Mask personal data in the shared copy
# MAGIC
# MAGIC Only the forms and letters carry names, emails, and phone numbers. `ai_mask` replaces each with a mask token.

# COMMAND ----------

mask_labels = "array(" + ", ".join(a.sql_string(x) for x in spec["mask"]["labels"]) + ")"
mask_started = datetime.now(timezone.utc)
spark.sql(f"""
CREATE OR REPLACE TABLE {T['masked']} AS
SELECT c.file_name, c.route AS doc_type, ai_mask(p.text, {mask_labels}) AS masked_text
FROM {T['classified']} c JOIN {T['parsed']} p ON c.path = p.path
WHERE c.route IN ('intake_form', 'letter')
""")
mask_ended = datetime.now(timezone.utc)
leaks = []
masked_rows = spark.table(T["masked"]).collect()
for r in masked_rows:
    leaks += [f"{r.file_name}:{v}" for v in a.leaked(r.masked_text, list(truth[r.file_name].planted))]
planted_total = sum(len(truth[r.file_name].planted) for r in masked_rows)
mask_chars = spark.sql(f"SELECT coalesce(sum(p.chars), 0) FROM {T['classified']} c JOIN {T['parsed']} p ON c.path = p.path WHERE c.route IN ('intake_form', 'letter')").first()[0]
display(spark.table(T["masked"]).orderBy("file_name"))

# COMMAND ----------

ended = datetime.now(timezone.utc)
a.write_results(spark, T["results"], "validate", [
    ("validated", len(passed), "documents that passed every check"),
    ("quarantined", len(held), "documents held for review"),
    ("planned_failures_caught", len(should_hold) - len(missed), f"of {len(should_hold)} documents built to fail; missed: {missed}"),
    ("good_documents_held_back", len(extra), f"{extra}"),
    ("masked_documents", len(masked_rows), "forms and letters"),
    ("planted_values", planted_total, "names, emails, and phone numbers put in the sample documents"),
    ("planted_values_leaked", len(leaks), f"{leaks}"),
    ("mask_seconds", (mask_ended - mask_started).total_seconds(), "ai_mask over the forms and letters"),
    ("mask_input_chars", mask_chars, "characters sent to ai_mask"),
], run_id)
d.log_step(spark, T["run_log"], run_id, "validate", started, mask_started, documents=len(truth))
d.log_step(spark, T["run_log"], run_id, "mask", mask_started, mask_ended, documents=len(masked_rows), input_chars=int(mask_chars))
