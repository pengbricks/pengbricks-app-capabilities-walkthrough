# Databricks notebook source
# MAGIC %md
# MAGIC # 1. Exit inventory
# MAGIC
# MAGIC Lists every table and view in the schema from `information_schema.tables`, then reads each table's properties and `DESCRIBE DETAIL` to find the format, the files' location, the size, whether Iceberg clients can read it, and the Delta features that outside readers must support. The result lands in `exit_inventory` with a portability verdict: runs as is, needs changes, or rebuild.
# MAGIC
# MAGIC Safe to rerun: `exit_inventory` is overwritten on every run. The notebook only reads the other tables.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from open_data.exit_inventory import inventory_row, props_from_rows
params = load_params(dbutils, "capability_guides_migrate_off_databricks", ['catalog', 'schema'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"
TARGET = "exit_inventory"

from pyspark.sql import types as T

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read the catalog metadata
# MAGIC
# MAGIC `information_schema.tables` gives the table type (MANAGED, EXTERNAL, VIEW, FOREIGN, shallow clones, and so on), the data source format, and the storage root URL (`storage_path`, empty for views).

# COMMAND ----------

tables = spark.sql(f"""
  SELECT table_name, table_type, data_source_format, storage_path
  FROM {catalog}.information_schema.tables
  WHERE table_schema = '{schema}' AND table_name <> '{TARGET}'
  ORDER BY table_name
""").collect()
print(f"{len(tables)} objects in {prefix}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read properties and details
# MAGIC
# MAGIC A table the account cannot read, or a format without `DESCRIBE DETAIL` (managed Iceberg, views), keeps the information_schema values. The verdict then rests on those.

# COMMAND ----------

rows = []
for t in tables:
    fq = f"{prefix}.`{t.table_name}`"
    props, detail = {}, {}
    if t.table_type not in ("VIEW", "MATERIALIZED_VIEW", "STREAMING_TABLE"):
        try:
            props = props_from_rows(spark.sql(f"SHOW TBLPROPERTIES {fq}").collect())
        except Exception as error:
            print(f"{fq}: properties unavailable ({str(error)[:80]})")
        if (t.data_source_format or "").upper() == "DELTA":
            try:
                detail = spark.sql(f"DESCRIBE DETAIL {fq}").first().asDict()
            except Exception as error:
                print(f"{fq}: DESCRIBE DETAIL unavailable ({str(error)[:80]})")
    rows.append(inventory_row(catalog, schema, t.table_name, t.table_type, t.data_source_format, t.storage_path, props, detail))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write exit_inventory

# COMMAND ----------

schema_def = T.StructType([
    T.StructField("table_name", T.StringType()),
    T.StructField("table_type", T.StringType()),
    T.StructField("format", T.StringType()),
    T.StructField("managed_or_external", T.StringType()),
    T.StructField("iceberg_readability", T.StringType()),
    T.StructField("reader_features", T.StringType()),
    T.StructField("location", T.StringType()),
    T.StructField("size_bytes", T.LongType()),
    T.StructField("verdict", T.StringType()),
    T.StructField("reason", T.StringType()),
])
frame = spark.createDataFrame([tuple(r[f.name] for f in schema_def.fields) for r in rows], schema_def)
frame.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{prefix}.{TARGET}")
spark.sql(f"COMMENT ON TABLE {prefix}.{TARGET} IS 'Exit inventory: format, location, Iceberg readability, reader-side Delta features, and portability verdict per table.'")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary by verdict

# COMMAND ----------

display(spark.sql(f"SELECT verdict, managed_or_external, count(*) AS objects, sum(size_bytes) AS size_bytes FROM {prefix}.{TARGET} GROUP BY ALL ORDER BY verdict"))
display(spark.table(f"{prefix}.{TARGET}"))
