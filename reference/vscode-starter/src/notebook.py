# Databricks notebook source
# MAGIC %md
# MAGIC # Daily orders
# MAGIC
# MAGIC The same file runs two ways. In VS Code, each cell shows Run Cell, Run Above, and Debug Cell: your Python runs
# MAGIC locally and Spark work runs on serverless compute through Databricks Connect. In the workspace (and as the job's
# MAGIC first task) it is an ordinary notebook. The logic lives in the `orders_demo` package, not here.

# COMMAND ----------

from orders_demo import clean_orders, daily_revenue, sample_orders, spark_daily_revenue

raw = sample_orders()
print(f"{len(raw)} raw orders")

# COMMAND ----------

# Plain pandas: runs on your machine in VS Code, so a breakpoint here steps through the real code.
cleaned = clean_orders(raw)
print(f"{len(raw) - len(cleaned)} orders dropped")
display(cleaned)

# COMMAND ----------

# Spark: `spark` is a Databricks Connect session in VS Code and the built-in session on Databricks.
spark_totals = spark_daily_revenue(spark.createDataFrame(cleaned))
display(spark_totals)

# COMMAND ----------

# Both engines must agree. A failed assert here fails the job's first task.
expected = daily_revenue(cleaned)
actual = spark_totals.toPandas()
assert len(actual) == len(expected), f"Spark has {len(actual)} rows, pandas has {len(expected)}"
assert abs(actual["revenue"].sum() - expected["revenue"].sum()) < 0.01
print(f"OK: {len(actual)} day and category rows, revenue {actual['revenue'].sum():.2f}")
