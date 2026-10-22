# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from datetime import datetime, timezone
params = load_params(dbutils, "capability_guides_ingestion_framework", ["catalog", "schema", "use_case"])

dbutils.widgets.text("feed", "")
dbutils.widgets.text("run_id", "")
feed_widget = dbutils.widgets.get("feed").strip()
run_id = dbutils.widgets.get("run_id").strip() or "manual-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
print(f"feed = {feed_widget or '(all feeds in the use case)'}")
print(f"run_id = {run_id}")

from capability_framework.config import load_feed
from capability_framework.runner import run_feed
from capability_framework.use_case import feed_names, load_use_case

# COMMAND ----------

# MAGIC %md
# MAGIC ## Choose the feeds
# MAGIC
# MAGIC In the job, `feed` holds one feed name per `for_each` iteration. Standalone, a blank `feed` widget processes every feed in the use case. Safe to rerun: silver is merged by feed and key, and `audit_log` adds one row per feed run.

# COMMAND ----------

spec = load_use_case(bundle_root() / "use_cases" / f"{params['use_case']}.yml")
feeds_dir = bundle_root() / "feeds" / params["use_case"]
feeds = [feed_widget] if feed_widget else feed_names(spec)
print(feeds)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run the shared framework per feed
# MAGIC
# MAGIC `run_feed` is the same function for every feed. It reads the landing folder, applies the mapping and rules, merges valid rows into `transactions_silver`, replaces that feed's quarantine rows, and writes one `audit_log` row. A failure is recorded and re-raised.

# COMMAND ----------

for name in feeds:
    config = load_feed(feeds_dir, name)
    record = run_feed(spark, config, params["catalog"], params["schema"], run_id)
    print(f"{record.feed}: read={record.rows_read} valid={record.rows_valid} quarantined={record.rows_quarantined} status={record.status}")
