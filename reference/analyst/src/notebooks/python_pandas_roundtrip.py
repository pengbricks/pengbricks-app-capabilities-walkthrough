# Databricks notebook source
# MAGIC %md
# MAGIC # Python notebook: SQL to pandas and back
# MAGIC Query a governed table, analyze the result in pandas, and write it back to Unity Catalog.

# COMMAND ----------
from databricks.sdk.runtime import dbutils, spark

dbutils.widgets.text("catalog", "")
dbutils.widgets.text("schema", "")
fq = f"{dbutils.widgets.get('catalog')}.{dbutils.widgets.get('schema')}"

# COMMAND ----------
# MAGIC %md ## 1. Query with SQL, collect to pandas

# COMMAND ----------
monthly = spark.sql(
    f"""
    SELECT c.region, DATE_TRUNC('MONTH', o.order_ts) AS month,
           CAST(SUM(o.quantity * o.unit_price) AS DOUBLE) AS revenue
    FROM {fq}.orders o JOIN {fq}.customers c USING (customer_id)
    WHERE o.status IN ('completed', 'shipped')
    GROUP BY 1, 2
    """
).toPandas()
print(monthly.shape)

# COMMAND ----------
# MAGIC %md ## 2. Analyze in pandas: pivot, rolling mean, growth

# COMMAND ----------
import pandas as pd

wide = monthly.pivot(index="month", columns="region", values="revenue").sort_index()
rolling = wide.rolling(3).mean().add_suffix("_3mo_avg")
growth = wide.pct_change().add_suffix("_mom")
result = pd.concat([wide, rolling, growth], axis=1).reset_index()
result["month"] = result["month"].dt.date
display(result.head(6))

# COMMAND ----------
# MAGIC %md ## 3. Round trip: write the pandas result back to Unity Catalog

# COMMAND ----------
target = f"{fq}.pandas_region_trend"
spark.createDataFrame(result).write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
back = spark.table(target).toPandas()
assert len(back) == len(result), "round trip lost rows"
print(f"Wrote and re-read {len(back)} rows from {target}")
