"""Scratch script for the demo: debug a transform with Databricks Connect.

Open this file, set a breakpoint where the comment says, then choose Run on Databricks > Debug current
file with Databricks Connect. The Python runs locally, so you can step into `clean_orders`. The Spark work
runs on serverless compute. Bundle deploys skip this folder, so it never reaches the workspace.
"""

from databricks.connect import DatabricksSession

from orders_demo import clean_orders, sample_orders, spark_daily_revenue

# Uses the profile the extension selected. Outside VS Code, set DATABRICKS_CONFIG_PROFILE=<profile>.
spark = DatabricksSession.builder.serverless().getOrCreate()

raw = sample_orders()
cleaned = clean_orders(raw)

# Set a breakpoint on the next line. In the Variables pane compare `raw` with `cleaned`, then
# step into spark_daily_revenue (F11) and watch the DataFrame being built.
totals = spark_daily_revenue(spark.createDataFrame(cleaned))

dropped = raw[~raw["order_id"].isin(cleaned["order_id"])]
print(f"Dropped {len(dropped)} of {len(raw)} orders:")
print(dropped[["order_id", "customer_id", "quantity", "status"]].to_string(index=False))
print("Daily revenue from serverless compute:")
totals.show()
