# Databricks notebook source
import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from capability_framework.rollback import choose_target

params = load_params(dbutils, "capability_guides_rollback", ["table"])
dbutils.widgets.text("version", "")
version = dbutils.widgets.get("version").strip()
table = params["table"]
print(f"version = {version or '(blank: undo the latest write)'}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the table's history
# MAGIC
# MAGIC `DESCRIBE HISTORY` lists every Delta version, newest first.

# COMMAND ----------

history = spark.sql(f"DESCRIBE HISTORY {table}").select("version", "operation").orderBy("version", ascending=False).collect()
display(spark.createDataFrame([(row.version, row.operation) for row in history], "version INT, operation STRING"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Choose the version to restore
# MAGIC
# MAGIC With a blank `version`, the target is the version before the latest write. If the latest entry is already a `RESTORE`, the write was undone and a rerun does nothing.

# COMMAND ----------

target = choose_target([(row.version, row.operation) for row in history], version)
if target is None:
    print(f"{table} is already rolled back (latest version {history[0].version} is a RESTORE); nothing to do")
else:
    print(f"Restoring {table} from version {history[0].version} to version {target}")
    display(spark.sql(f"RESTORE TABLE {table} TO VERSION AS OF {target}"))
