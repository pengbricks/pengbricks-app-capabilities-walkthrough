# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 3. Notebook charts on governed views
# MAGIC
# MAGIC Reads `v_revenue_by_month` and `v_revenue_by_region_segment`, draws two charts with matplotlib, saves them to a volume, and records the totals. The chart files and the totals table are overwritten on each run.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_visualization", ['catalog', 'schema', 'use_case', 'warehouse_id', 'dashboard_id'])
catalog, schema = params["catalog"], params["schema"]
fq = f"{catalog}.{schema}"
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the views

# COMMAND ----------

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

volume = f"/Volumes/{catalog}/{schema}/charts"
monthly = spark.table(f"{fq}.v_revenue_by_month").orderBy("month").toPandas()
monthly["revenue"] = monthly["revenue"].astype(float)
by_region = spark.table(f"{fq}.v_revenue_by_region_segment").toPandas()
by_region["revenue"] = by_region["revenue"].astype(float)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Chart 1: revenue by month

# COMMAND ----------

os.makedirs(volume, exist_ok=True)

fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(monthly["month"], monthly["revenue"], marker="o", color="#0072B2")
ax.set_title("Revenue by month")
ax.set_ylabel("Revenue (USD)")
ax.tick_params(axis="x", rotation=45)
fig.tight_layout()
fig.savefig(f"{volume}/revenue_by_month.png", dpi=150)
display(fig)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Chart 2: revenue by region and segment

# COMMAND ----------

pivot = by_region.pivot(index="region", columns="segment", values="revenue")
fig2, ax2 = plt.subplots(figsize=(8, 4))
pivot.plot(kind="bar", stacked=True, ax=ax2, color=["#0072B2", "#E69F00", "#009E73"])
ax2.set_title("Revenue by region and segment")
ax2.set_ylabel("Revenue (USD)")
ax2.tick_params(axis="x", rotation=0)
fig2.tight_layout()
fig2.savefig(f"{volume}/revenue_by_region_segment.png", dpi=150)
display(fig2)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the plotted totals
# MAGIC
# MAGIC The totals check compares these with the dashboard.

# COMMAND ----------

from decimal import Decimal

rows = [
    ("v_revenue_by_month", str(sum(Decimal(str(round(v, 2))) for v in monthly["revenue"])), "revenue_by_month.png"),
    ("v_revenue_by_region_segment", str(sum(Decimal(str(round(v, 2))) for v in by_region["revenue"])), "revenue_by_region_segment.png"),
]
spark.createDataFrame(rows, "view_name STRING, total_revenue STRING, chart_file STRING").write.mode("overwrite").option(
    "overwriteSchema", "true"
).saveAsTable(f"{fq}.chart_totals")
print(rows)
print(os.listdir(volume))
