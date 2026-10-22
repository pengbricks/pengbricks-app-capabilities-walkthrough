# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ingestion_framework", ["catalog", "schema", "use_case"])

from capability_framework.datagen import feed_frame
from capability_framework.runner import ensure_tables
from capability_framework.use_case import feed_names, load_use_case

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the use-case spec
# MAGIC
# MAGIC The spec lists the feeds, their file formats, and the shape of the sample data. Everything below is driven by it. Safe to rerun: tables are created if missing and each feed's folder is overwritten.

# COMMAND ----------

spec = load_use_case(bundle_root() / "use_cases" / f"{params['use_case']}.yml")
landing = f"/Volumes/{params['catalog']}/{params['schema']}/landing"
print([feed["name"] for feed in spec["feeds"]])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the framework tables
# MAGIC
# MAGIC `ensure_tables` creates `transactions_silver`, `transactions_quarantine`, and `audit_log` if they do not exist.

# COMMAND ----------

ensure_tables(spark, params["catalog"], params["schema"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Land one folder per feed
# MAGIC
# MAGIC Each feed is generated from the same canonical rows with a fixed seed, then written in the provider's own format.
# MAGIC `overwrite` replaces the feed's folder, so running this notebook again leaves the same files.

# COMMAND ----------

for index, feed in enumerate(spec["feeds"]):
    df = feed_frame(spark, spec, feed, seed_offset=index)
    writer = df.coalesce(1).write.mode("overwrite")
    path = f"{landing}/{feed['name']}"
    if feed["format"] == "csv":
        writer.option("header", "true").csv(path)
    else:
        writer.format(feed["format"]).save(path)
    print(f"Landed {feed['rows']} rows for {feed['name']} at {path}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Hand the feed list to the next task
# MAGIC
# MAGIC In the job, the `for_each` task iterates over this list. Run on its own, the next notebook reads the same list from the spec.

# COMMAND ----------

try:
    dbutils.jobs.taskValues.set(key="feeds", value=feed_names(spec))
except Exception as error:  # outside a job there is no task to hold the value
    print(f"Task value not set ({type(error).__name__}); the next notebook reads the feeds from the spec")
