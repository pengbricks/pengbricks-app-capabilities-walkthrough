# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_dataops", ["catalog", "schema", "use_case"])

from capability_framework.datagen import feed_frame
from capability_framework.runner import ensure_tables
from capability_framework.use_case import load_use_case

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the framework tables and land the feed files
# MAGIC
# MAGIC Same step as in *Configuration-driven ingestion*. `overwrite` replaces each feed's folder, so a rerun leaves the same files.

# COMMAND ----------

spec = load_use_case(bundle_root() / "use_cases" / f"{params['use_case']}.yml")
landing = f"/Volumes/{params['catalog']}/{params['schema']}/landing"
ensure_tables(spark, params["catalog"], params["schema"])
for index, feed in enumerate(spec["feeds"]):
    df = feed_frame(spark, spec, feed, seed_offset=index)
    writer = df.coalesce(1).write.mode("overwrite")
    path = f"{landing}/{feed['name']}"
    if feed["format"] == "csv":
        writer.option("header", "true").csv(path)
    else:
        writer.format(feed["format"]).save(path)
    print(f"Landed {feed['rows']} rows for {feed['name']} at {path}")
