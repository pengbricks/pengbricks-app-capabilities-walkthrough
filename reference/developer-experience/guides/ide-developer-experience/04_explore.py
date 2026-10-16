# Databricks notebook source
# MAGIC %md
# MAGIC # Explore dx_demo
# MAGIC
# MAGIC Interactive authoring: import the package, run a transform, and inspect the result. Set a breakpoint in `clean_records` and use the notebook debugger to step into it. This notebook is not a job task.

# COMMAND ----------

import sys, os
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root
sys.path.insert(0, str(bundle_root() / "src"))

from datetime import datetime
from dx_demo.transforms import add_date, clean_records

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run a transform on a few rows
# MAGIC
# MAGIC The duplicate `a-1 ` and `A-1` collapse to one record, and the negative amount is dropped.

# COMMAND ----------

raw = spark.createDataFrame(
    [("a-1 ", 10.0, datetime(2024, 1, 1)), ("A-1", 30.0, datetime(2024, 1, 2)), ("B-1", -4.0, datetime(2024, 1, 1))],
    "order_id string, amount double, updated_at timestamp",
)
display(add_date(clean_records(raw, "order_id", "amount", "updated_at"), "updated_at"))
