# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from datetime import datetime, timezone
params = load_params(dbutils, "capability_guides_dataops", ["catalog", "schema", "use_case"])

dbutils.widgets.text("feed", "provider_a")
dbutils.widgets.text("run_id", "")
dbutils.widgets.text("simulate_transient_failure", "false")
feed = dbutils.widgets.get("feed").strip() or "provider_a"
run_id = dbutils.widgets.get("run_id").strip() or "manual-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
simulate = dbutils.widgets.get("simulate_transient_failure").strip().lower() == "true"
print(f"feed = {feed}, run_id = {run_id}, simulate_transient_failure = {simulate}")

from capability_framework.config import load_feed
from capability_framework.retry_demo import simulate_transient_failure
from capability_framework.runner import run_feed

# COMMAND ----------

# MAGIC %md
# MAGIC ## Fail the first attempt on purpose
# MAGIC
# MAGIC The job sets `max_retries: 2`. A marker file keyed on the job run id makes only the first attempt fail, so the run page shows attempt 0 failed and attempt 1 succeeded. Safe to rerun: silver is merged by key and the feed's quarantine rows are replaced; `audit_log` adds one row per attempt, which is how the retry shows up.

# COMMAND ----------

if simulate:
    simulate_transient_failure(dbutils, params["catalog"], params["schema"], run_id)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Ingest the feed
# MAGIC
# MAGIC The same shared framework as the other guides. It records a failure in `audit_log` and re-raises, so the retry and alert settings apply.

# COMMAND ----------

config = load_feed(bundle_root() / "feeds" / params["use_case"], feed)
record = run_feed(spark, config, params["catalog"], params["schema"], run_id)
print(f"{record.feed}: read={record.rows_read} valid={record.rows_valid} quarantined={record.rows_quarantined} status={record.status}")
