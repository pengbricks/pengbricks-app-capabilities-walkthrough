# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Build the sample tables
# MAGIC
# MAGIC Builds the table chain defined in the use-case spec so Unity Catalog records lineage. Generated tables use `dbldatagen` with a fixed seed. Derived tables are `CREATE OR REPLACE TABLE ... AS` statements. Every table is replaced, so a rerun gives the same rows.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_documentation_refresh", ["catalog", "schema", "use_case"])
catalog, schema = params["catalog"], params["schema"]

from spec_helpers import column_kwargs, load_spec, python_rows, render_sql
spec = load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
seed = spec["seed"]
fq = {t["name"]: f"`{catalog}`.`{schema}`.`{t['name']}`" for t in spec["tables"]}

# COMMAND ----------

# MAGIC %md
# MAGIC ## Generate a table
# MAGIC
# MAGIC `dbldatagen` builds the rows from the column specs. If it fails, a seeded Python generator reads the same spec.

# COMMAND ----------

def generate_dbldatagen(table):
    import dbldatagen as dg
    gen = dg.DataGenerator(spark, name=table["name"], rows=table["rows"], seedMethod="hash_fieldname",
                           seed=seed, partitions=4)
    for col in table["columns"]:
        gen = gen.withColumn(col["name"], **column_kwargs(col))
    return gen.build()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Build the chain, then tag it
# MAGIC
# MAGIC A governed-tag policy can reject a tag value in some workspaces, so a failed tag is a warning, not an error.

# COMMAND ----------

for t in spec["tables"]:
    target = fq[t["name"]]
    if t["kind"] == "generate":
        try:
            df, method = generate_dbldatagen(t), "dbldatagen"
        except Exception as e:  # noqa: BLE001
            print(f"WARN dbldatagen failed ({str(e)[:200]}); using seeded Python fallback")
            rows, ddl = python_rows(t, seed)
            df, method = spark.createDataFrame(rows, ddl), "python-fallback"
        df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
        print(f"{t['name']}: generated {t['rows']} rows via {method}, seed {seed}")
    elif t["kind"] == "sql":
        spark.sql(f"CREATE OR REPLACE TABLE {target} AS {render_sql(t['sql'], fq)}")
        print(f"{t['name']}: built from SQL")
    else:
        raise ValueError(f"unknown table kind {t['kind']}")
    for k, v in (spec.get("tags") or {}).items():
        try:
            spark.sql(f"ALTER TABLE {target} SET TAGS ('{k}' = '{v}')")
        except Exception as e:  # noqa: BLE001
            print(f"WARN could not set tag {k}={v} on {target}: {str(e)[:200]}")
    if t.get("comment_hint"):
        spark.sql(f"ALTER TABLE {target} SET TBLPROPERTIES ('doc_hint' = '{t['comment_hint'].replace(chr(39), '')}')")

# COMMAND ----------

for t in spec["tables"]:
    print(t["name"], spark.table(fq[t["name"]]).count())
