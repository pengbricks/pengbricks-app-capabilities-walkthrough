# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Pull the REST API
# MAGIC
# MAGIC Pulls every page of an authenticated endpoint into Delta, with a request log. Writes `api_users` (the records, overwritten each run), `api_request_log` (one row per HTTP attempt) and `api_pull_runs` (one summary row per run). Fails if the record count does not match the total the API reports or if an id repeats across pages.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_rest_api", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Log in and fetch all pages

# COMMAND ----------

from datetime import datetime, timezone
import requests
from source_ingestion.api_client import ApiError, TokenManager, fetch_all_pages
from source_ingestion.api_records import flatten_user
from source_ingestion.spec import load_spec

cfg = load_spec(SPEC_FILE)["rest_api"]
started = datetime.now(timezone.utc)

session = requests.Session()
tokens = TokenManager(
    session, cfg["base_url"], cfg["username"], cfg["password"], refresh_after_seconds=cfg["refresh_after_seconds"]
)
result = fetch_all_pages(
    session,
    tokens,
    url=f"{cfg['base_url']}{cfg['endpoint']}",
    records_key="users",
    page_size=cfg["page_size"],
    max_retries=cfg["max_retries"],
    backoff_base=cfg["backoff_base_seconds"],
    page_delay=cfg["page_delay_seconds"],
    inject_invalid_token_on_page=cfg.get("inject_invalid_token_on_page"),
)

users = [flatten_user(u) for u in result.records]
distinct = len({u["user_id"] for u in users})
pages = len({row["page"] for row in result.log})
ok_requests = sum(1 for row in result.log if row["http_status"] == 200)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Land the records (overwritten each run)

# COMMAND ----------

spark.createDataFrame(
    users,
    "user_id int, first_name string, last_name string, email string, username string, phone string, "
    "city string, country string, company string, birth_date string, raw_json string",
).write.mode("overwrite").saveAsTable(f"{ns}.api_users")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the request log and the run summary

# COMMAND ----------

run_id = params["run_id"]
log_rows = [
    (run_id, r["page"], r["skip"], r["limit"], r["attempt"], r["http_status"], r["error"], r["records"],
     r["latency_ms"], r["token_refreshes"])
    for r in result.log
]
spark.createDataFrame(
    log_rows,
    "run_id string, page int, skip int, page_limit int, attempt int, http_status int, error string, "
    "records int, latency_ms int, token_refreshes int",
).write.mode("append").saveAsTable(f"{ns}.api_request_log")

summary = (
    run_id, started, datetime.now(timezone.utc), pages, len(result.log), ok_requests, result.retries,
    result.token_logins, result.token_refreshes, len(users), distinct, result.total,
)
spark.createDataFrame(
    [summary],
    "run_id string, started_at timestamp, finished_at timestamp, pages int, http_attempts int, ok_requests int, "
    "retries int, token_logins int, token_refreshes int, records int, distinct_ids int, api_total int",
).write.mode("append").saveAsTable(f"{ns}.api_pull_runs")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check the counts

# COMMAND ----------

print(
    f"pages={pages} attempts={len(result.log)} retries={result.retries} logins={result.token_logins} "
    f"refreshes={result.token_refreshes} records={len(users)} distinct={distinct} api_total={result.total}"
)
if not (len(users) == distinct == result.total):
    raise ApiError(f"records={len(users)} distinct={distinct} api_total={result.total}")
