# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Fragile step (fails by design)
# MAGIC
# MAGIC Fails until the run is repaired. `{{job.repair_count}}` is 0 on the original run and 1 after the first repair, so the repair job's rerun passes. This is the failure that `05_repair_failed_run` repairs.
# MAGIC
# MAGIC Standalone, a blank `repair_count` means repaired, so the notebook succeeds. Type `0` to see the failure.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_operational_support", ['catalog', 'schema', 'use_case'])

# COMMAND ----------

dbutils.widgets.text("repair_count", "")
repair_count = int(dbutils.widgets.get("repair_count") or 1)

# COMMAND ----------

# MAGIC %md
# MAGIC ## The task

# COMMAND ----------

class TransientSourceError(RuntimeError):
    pass


def fragile_step(repair_count, **_):
    """Fails until the run is repaired. {{job.repair_count}} is 0 on the original run and 1 after the first repair."""
    if repair_count == 0:
        raise TransientSourceError("TransientSourceError: upstream dependency unavailable on first attempt (by design). Repair the run to retry this task.")
    print(f"repair_count={repair_count}: dependency available, step complete")

# COMMAND ----------

fragile_step(repair_count)
