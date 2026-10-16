# Databricks notebook source
import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_ingestion_framework", ["catalog", "schema", "use_case"])

dbutils.widgets.text("run_id", "")
prefix = f"{params['catalog']}.{params['schema']}"
run_id = dbutils.widgets.get("run_id").strip()
if not run_id:
    run_id = spark.sql(f"SELECT run_id FROM {prefix}.audit_log ORDER BY started_at DESC LIMIT 1").first()["run_id"]
print(f"run_id = {run_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Compare the feeds in this run
# MAGIC
# MAGIC Every feed wrote one row to `audit_log`, so both feeds compare through the same table and the same columns.

# COMMAND ----------

summary = spark.sql(
    f"""
    SELECT feed, status, rows_read, rows_valid, rows_quarantined,
           round(rows_quarantined * 100.0 / nullif(rows_read, 0), 2) AS quarantine_pct,
           timestampdiff(SECOND, started_at, ended_at) AS duration_seconds
    FROM {prefix}.audit_log
    WHERE run_id = :run_id
    ORDER BY feed
    """,
    args={"run_id": run_id},
)
display(summary)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Why rows were quarantined
# MAGIC
# MAGIC Both feeds fail the same shared rules, so the reasons line up.

# COMMAND ----------

reasons = spark.sql(
    f"""
    SELECT source_feed, reason, count(*) AS rows
    FROM {prefix}.transactions_quarantine LATERAL VIEW explode(_quarantine_reasons) r AS reason
    WHERE ingest_run_id = :run_id
    GROUP BY ALL ORDER BY source_feed, rows DESC
    """,
    args={"run_id": run_id},
)
display(reasons)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Fail the task if any feed did not succeed

# COMMAND ----------

failed = [row.feed for row in summary.collect() if row.status != "SUCCEEDED"]
if failed or summary.count() == 0:
    raise RuntimeError(f"Feeds without a successful audit record in run {run_id}: {failed or 'none recorded'}")
