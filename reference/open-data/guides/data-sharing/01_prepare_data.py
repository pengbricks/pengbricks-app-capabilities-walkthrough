# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Prepare the governed data
# MAGIC
# MAGIC Creates the source tables from the use-case spec and the view the share exposes. The view keeps one region and leaves out `customer_email`. Every table is overwritten, so a rerun replaces the data.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_data_sharing", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Drop the previous share
# MAGIC
# MAGIC The last run leaves its share in place for inspection. A shared view can't be replaced, so drop the share first. `02_share_and_read` recreates it.

# COMMAND ----------

from open_data.spec import load_spec, write_tables

spec = load_spec(SPEC_FILE)
sharing = spec["sharing"]
spark.sql(f"DROP SHARE IF EXISTS {sharing['share_name']}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write the tables

# COMMAND ----------

write_tables(spark, spec, prefix, list(spec["tables"]))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the row-limiting view

# COMMAND ----------

columns = ", ".join(sharing["view_columns"])
view = f"{prefix}.{sharing['view_name']}"
spark.sql(
    f"CREATE OR REPLACE VIEW {view} "
    f"COMMENT 'Orders for one region without personal data. This is the only orders object the share exposes.' AS "
    f"SELECT {columns} FROM {prefix}.sharing_orders WHERE region = '{sharing['view_region']}'"
)
print(f"{view}: {spark.table(view).count()} rows")
