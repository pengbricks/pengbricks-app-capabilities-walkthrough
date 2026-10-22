# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Write with a retry
# MAGIC
# MAGIC Fails on its first execution and succeeds on the retry, which the job's retry policy (`max_retries`, `min_retry_interval_millis`, `timeout_seconds`) triggers. The write is a `MERGE` keyed by item id, so reruns and retries never duplicate rows. The 25 work items stay 25 rows.
# MAGIC
# MAGIC Standalone, a blank `execution_count` means a retry attempt, so the notebook succeeds. Type `1` to see the first-attempt failure. Safe to rerun: the MERGE is keyed by item id, so the table keeps 25 rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_operational_support", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

from support_lib import load_support_spec
spec = load_support_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
catalog, schema = params["catalog"], params["schema"]
dbutils.widgets.text("execution_count", "")
execution_count = int(dbutils.widgets.get("execution_count") or 2)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The task

# COMMAND ----------

class TransientSourceError(RuntimeError):
    pass


def write_with_retry(spark, spec, catalog, schema, execution_count, **_):
    """Fail the first execution, succeed on the retry. The MERGE is keyed by item id, so reruns never duplicate rows."""
    if execution_count <= 1:
        raise TransientSourceError("Simulated transient upstream outage on first execution; the task retry policy will rerun")
    from sample_data import generate

    cfg = spec["work_items"]
    spec_df = generate(
        spark,
        [
            {"name": "queue", "type": "string", "values": ["ingest", "reporting", "access"]},
            {"name": "priority", "type": "string", "values": ["p1", "p2", "p3"], "weights": [1, 3, 6]},
            {"name": "payload_kb", "type": "int", "min": 1, "max": 512},
        ],
        rows=cfg["count"], seed=cfg["seed"], name="work_items", partitions=1, keep_id=True,
    )
    spec_df.createOrReplaceTempView("_work_items")
    table = f"{catalog}.{schema}.support_work_items"
    spark.sql(f"CREATE TABLE IF NOT EXISTS {table} (id BIGINT, queue STRING, priority STRING, payload_kb INT, written_at TIMESTAMP)")
    spark.sql(
        f"""MERGE INTO {table} t USING (SELECT *, current_timestamp() AS written_at FROM _work_items) s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET t.queue = s.queue, t.priority = s.priority, t.payload_kb = s.payload_kb
            WHEN NOT MATCHED THEN INSERT *"""
    )
    n = spark.table(table).count()
    print(f"execution {execution_count}: merged {cfg['count']} work items; table holds {n} rows")

# COMMAND ----------

write_with_retry(spark, spec, catalog, schema, execution_count)
