# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 6. Measure what the run cost
# MAGIC
# MAGIC **Pattern: measure on a sample, then extrapolate.** The pipeline logged when each step ran and how many documents and pages it handled (`dp_run_log`). This notebook reads what the run was billed from `system.billing.usage` and divides by the pages and documents processed.
# MAGIC
# MAGIC What it counts:
# MAGIC
# MAGIC - **AI Functions usage** (`billing_origin_product = 'AI_FUNCTIONS'`), split by `product_features.ai_functions.ai_function`: `AI_PARSE_DOCUMENT`, `AI_CLASSIFY`, `AI_EXTRACT`, `AI_MASK`. Rows are kept when they belong to this workspace and this identity and overlap the run's time window. If any of them carry this run's `job_run_id`, only those are kept. If none do, rows with no `job_run_id` are kept and the result says so.
# MAGIC - **Serverless compute** (`billing_origin_product = 'JOBS'`) for rows with this run's `job_run_id`.
# MAGIC - **Storage** is not in `system.billing.usage`. The notebook records the bytes stored; price them with your cloud storage rate.
# MAGIC
# MAGIC `system.billing.usage` is account-wide, so the workspace and identity filters matter. Billing lands in the table hours after the work. The notebook polls for a few minutes, then records what is there and a `billing_status` of `complete`, `partial`, or `not_available`. **If the status is not `complete`, run this notebook again later**: it reads the most recent run from `dp_run_log`, or set the `measure_run_id` widget to a job run id.
# MAGIC
# MAGIC Costs are shown in DBUs (what the table records) and in USD at the list price from `system.billing.list_prices` in this workspace's account. List price is not your contract rate. Safe to rerun: the step's rows in `dp_results` and the table `dp_billing_usage` are replaced.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_document_processing", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema, run_id = params["catalog"], params["schema"], params["run_id"]
dbutils.widgets.text("measure_run_id", "")

import time
from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
import aif_lib as a
import docproc_lib as d
spec = d.load_spec(str(bundle_root() / "use_cases" / "documents.yml"))
T = {key: a.fq(catalog, schema, name) for key, name in spec["tables"].items()}
volume = f"/Volumes/{catalog}/{schema}/{spec['volume']}"
poll_minutes, poll_seconds = int(spec["cost"]["poll_minutes"]), int(spec["cost"]["poll_seconds"])

spark.conf.set("spark.sql.session.timeZone", "UTC")  # timestamps read back and the window filters below are all UTC
workspace_id = WorkspaceClient().get_workspace_id()
identity = spark.sql("SELECT current_user()").first()[0]
cost_started = datetime.now(timezone.utc)

# Which run to measure: the widget, else this job run, else the newest run in the log.
target = dbutils.widgets.get("measure_run_id").strip() or (run_id if run_id != "manual" else "")
if not target:
    target = spark.sql(f"SELECT run_id FROM {T['run_log']} WHERE step <> 'cost' GROUP BY run_id ORDER BY max(ended_at) DESC LIMIT 1").first()[0]
log = spark.sql(f"SELECT * FROM {T['run_log']} WHERE run_id = {a.sql_string(target)} AND step <> 'cost'").collect()
window_start, window_end = min(r.started_at for r in log), max(r.ended_at for r in log)
pages = max(r.pages for r in log)
documents = max(r.documents for r in log)
chars = {r.step: r.input_chars for r in log}
step_seconds = {r.step: r.seconds for r in log}
print(f"measuring run {target}: {documents} documents, {pages} pages, {window_start:%H:%M:%S} to {window_end:%H:%M:%S} UTC, workspace {workspace_id}, identity {identity}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the usage, polling briefly

# COMMAND ----------

def read_usage():
    return spark.sql(f"""
    SELECT u.billing_origin_product AS product, u.sku_name, u.usage_unit,
           coalesce(u.product_features.ai_functions.ai_function, '') AS ai_function,
           u.usage_metadata.job_run_id AS job_run_id, u.usage_start_time, u.usage_end_time,
           u.record_type, u.usage_quantity AS quantity, u.usage_quantity * p.pricing.effective_list.default AS list_usd
    FROM system.billing.usage u
    LEFT JOIN system.billing.list_prices p
      ON u.cloud = p.cloud AND u.sku_name = p.sku_name AND u.usage_unit = p.usage_unit
     AND u.usage_end_time >= p.price_start_time AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)
     AND p.currency_code = 'USD'
    WHERE u.workspace_id = '{workspace_id}'
      AND u.identity_metadata.run_as = {a.sql_string(identity)}
      AND u.usage_date BETWEEN date('{window_start:%Y-%m-%d}') AND date('{window_end:%Y-%m-%d}')
      AND u.usage_start_time < timestamp('{window_end:%Y-%m-%d %H:%M:%S}') AND u.usage_end_time > timestamp('{window_start:%Y-%m-%d %H:%M:%S}')
      AND ((u.billing_origin_product = 'AI_FUNCTIONS' AND (u.usage_metadata.job_run_id = {a.sql_string(target)} OR u.usage_metadata.job_run_id IS NULL))
        OR (u.billing_origin_product = 'JOBS' AND u.usage_metadata.job_run_id = {a.sql_string(target)}))
    """)

def watermark():
    return spark.sql(f"SELECT max(usage_end_time) FROM system.billing.usage WHERE workspace_id = '{workspace_id}' AND usage_date >= date('{window_start:%Y-%m-%d}')").first()[0]

deadline = time.time() + poll_minutes * 60
while True:
    usage = read_usage().collect()
    mark = watermark()
    status = d.billing_status(len(usage), mark, window_end)
    print(f"{datetime.now(timezone.utc):%H:%M:%S} {len(usage)} usage rows, newest usage_end_time in this workspace {mark}, status {status}")
    if status == "complete" or time.time() >= deadline:
        break
    time.sleep(poll_seconds)

# COMMAND ----------

from pyspark.sql import functions as F

# AI Functions rows carry the job run id when the call came from a job. If any row carries this run's id, keep only
# those and drop the rows with no id, which could belong to other work by the same identity in the same window.
usage_df = read_usage()
tagged = usage_df.where(f"product = 'AI_FUNCTIONS' AND job_run_id = {a.sql_string(target)}").count()
if tagged:
    usage_df = usage_df.where(f"NOT (product = 'AI_FUNCTIONS' AND job_run_id IS NULL)")
attribution = "job_run_id" if tagged else "identity and time window (AI Functions rows carry no job_run_id)"
usage_df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(T["billing"])
print("attribution:", attribution)
by_source = spark.sql(f"""
SELECT product, CASE WHEN ai_function = '' THEN sku_name ELSE ai_function END AS source, usage_unit,
       count(*) AS records, round(sum(quantity), 4) AS quantity, round(sum(list_usd), 4) AS list_usd
FROM {T['billing']} GROUP BY ALL ORDER BY product, source""")
display(by_source)

# COMMAND ----------

def total(column, where):
    value = spark.sql(f"SELECT sum({column}) FROM {T['billing']} WHERE {where}").first()[0]
    return float(value) if value is not None else None

ai_where = "product = 'AI_FUNCTIONS'"
dbu = {"ai_functions": total("quantity", ai_where), "jobs_serverless": total("quantity", "product = 'JOBS'")}
usd = {"ai_functions": total("list_usd", ai_where), "jobs_serverless": total("list_usd", "product = 'JOBS'")}
for fn in ["AI_PARSE_DOCUMENT", "AI_CLASSIFY", "AI_EXTRACT", "AI_MASK"]:
    dbu[fn.lower()] = total("quantity", f"ai_function = '{fn}'")
    usd[fn.lower()] = total("list_usd", f"ai_function = '{fn}'")
rows_in_table = spark.table(T["billing"]).count()

def row(metric, value, detail=""):
    return (metric, -1.0 if value is None else float(value), detail if value is not None else (detail + " no usage recorded yet").strip())

results = [
    ("billing_status", {"complete": 2.0, "partial": 1.0, "not_available": 0.0}[status],
     f"{status}: {rows_in_table} usage rows; newest usage_end_time in this workspace {mark}; run ended {window_end:%Y-%m-%d %H:%M:%S} UTC. "
     "complete = the table has caught up past the run; partial = it has not, so totals may be low; not_available = no rows yet"),
    ("measured_run", 0.0, f"job run {target}, {window_start:%Y-%m-%d %H:%M:%S} to {window_end:%H:%M:%S} UTC; AI Functions rows attributed by {attribution}"),
    ("documents", documents, "documents processed"),
    ("pages", pages, "pages parsed"),
    ("estimated_input_tokens", sum(chars.values()) / 4, "characters sent to ai_classify, ai_extract, and ai_mask divided by 4; an estimate, the task functions do not return token counts"),
    ("storage_bytes", sum(f.stat().st_size for f in os.scandir(f"{volume}/{spec['landing_folder']}")), "original files in the volume; storage is not in system.billing.usage"),
]
for key in ["ai_functions", "ai_parse_document", "ai_classify", "ai_extract", "ai_mask", "jobs_serverless"]:
    results.append(row(f"dbu_{key}", dbu.get(key), "DBU"))
    results.append(row(f"list_usd_{key}", usd.get(key), "USD at the list price in system.billing.list_prices; not a contract rate"))
all_dbu = (dbu["ai_functions"] or 0) + (dbu["jobs_serverless"] or 0) if rows_in_table else None
all_usd = (usd["ai_functions"] or 0) + (usd["jobs_serverless"] or 0) if rows_in_table else None
results += [
    row("dbu_total", all_dbu, "AI Functions plus serverless compute"),
    row("list_usd_total", all_usd, "USD at list price"),
    row("dbu_per_page_parse", d.per_unit(dbu["ai_parse_document"], pages), "ai_parse_document DBU divided by pages parsed"),
    row("dbu_per_page_ai_functions", d.per_unit(dbu["ai_functions"], pages), "all AI Functions DBU divided by pages parsed"),
    row("dbu_per_page_total", d.per_unit(all_dbu, pages), "AI Functions plus serverless compute, per page"),
    row("dbu_per_document_total", d.per_unit(all_dbu, documents), "AI Functions plus serverless compute, per document"),
    row("list_usd_per_page_parse", d.per_unit(usd["ai_parse_document"], pages), "USD at list price"),
    row("list_usd_per_page_ai_functions", d.per_unit(usd["ai_functions"], pages), "USD at list price"),
    row("list_usd_per_page_total", d.per_unit(all_usd, pages), "USD at list price"),
    row("list_usd_per_document_total", d.per_unit(all_usd, documents), "USD at list price"),
]
for step, seconds in step_seconds.items():
    results.append((f"seconds_{step}", float(seconds), "wall time of the step in the measured run"))
a.write_results(spark, T["results"], "cost", results, run_id)
d.log_step(spark, T["run_log"], run_id, "cost", cost_started, datetime.now(timezone.utc), documents=0, note=f"measured run {target}: {status}")
display(spark.table(T["results"]).where("step = 'cost'").orderBy("metric"))
