# Databricks notebook source
# MAGIC %md
# MAGIC # Explore dx_demo
# MAGIC Interactive authoring: import the package, run a transform, and inspect the result.
# MAGIC Set a breakpoint in `clean_orders` and use the notebook debugger to step into it.

# COMMAND ----------

import sys
from datetime import datetime
from pathlib import Path

# In the workspace, the bundle files sit next to this notebook.
sys.path.insert(0, str(Path.cwd().parent / "src") if Path.cwd().name != "src" else str(Path.cwd()))

from dx_demo.transforms import clean_orders, enrich_orders

# COMMAND ----------

raw = spark.createDataFrame(
    [("a-1 ", 10.0, datetime(2024, 1, 1)), ("A-1", 30.0, datetime(2024, 1, 2)), ("B-1", -4.0, datetime(2024, 1, 1))],
    "order_id string, amount double, updated_at timestamp",
)
display(enrich_orders(clean_orders(raw)))
