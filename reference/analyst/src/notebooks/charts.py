# Databricks notebook source
# MAGIC %md
# MAGIC # Notebook charts on governed views
# MAGIC Reads `v_revenue_by_month` and `v_revenue_by_region_segment`, draws two charts with matplotlib, saves them to a volume, and records the totals.

# COMMAND ----------
from databricks.sdk.runtime import dbutils, spark

dbutils.widgets.text("catalog", "")
dbutils.widgets.text("schema", "")
fq = f"{dbutils.widgets.get('catalog')}.{dbutils.widgets.get('schema')}"
volume = f"/Volumes/{dbutils.widgets.get('catalog')}/{dbutils.widgets.get('schema')}/charts"

# COMMAND ----------
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

monthly = spark.table(f"{fq}.v_revenue_by_month").orderBy("month").toPandas()
monthly["revenue"] = monthly["revenue"].astype(float)
by_region = spark.table(f"{fq}.v_revenue_by_region_segment").toPandas()
by_region["revenue"] = by_region["revenue"].astype(float)

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
# Record the totals the charts plotted, so the totals check can compare them with the dashboard.
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
