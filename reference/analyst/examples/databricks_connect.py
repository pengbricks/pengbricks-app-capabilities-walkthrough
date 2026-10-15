"""Databricks Connect on serverless compute. Install: pip install "databricks-connect>=17"."""

from databricks.connect import DatabricksSession

# Uses the profile created by `databricks auth login` (OAuth U2M). For M2M, set the
# DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET environment variables instead.
spark = DatabricksSession.builder.profile("DEFAULT").serverless(True).getOrCreate()

df = spark.table("<catalog>.<schema>.analyst_orders").groupBy("status").count()
df.show()
pdf = df.toPandas()  # results arrive in your local Python process
