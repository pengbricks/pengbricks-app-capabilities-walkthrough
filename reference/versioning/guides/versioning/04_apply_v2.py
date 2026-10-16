# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 4. Publish v2.0.0 (breaking)
# MAGIC
# MAGIC The breaking shape ships as a new table. The old name `customers_v1` becomes a view with the v1.1.0 shape, so existing consumers keep working until the sunset date. Run `03_apply_v1` first.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_versioning_release", ['catalog', 'schema', 'use_case', 'release'])
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"
CONTRACTS_DIR = ROOT / "contracts"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Load the contracts and run the gate again
# MAGIC
# MAGIC The same check the gate notebook ran. Publishing stops if the bump is wrong.

# COMMAND ----------

from compatibility import assert_compatible, compat_view_select, create_table_sql, migrate_select
from versioning_common import contracts_for, delta_version, fq, load_spec, register, set_tags

catalog, schema, release = params["catalog"], params["schema"], params["release"]
spec = load_spec(SPEC_FILE)
dataset = spec["dataset"]["name"]
contracts = contracts_for(CONTRACTS_DIR, spec)
v11, v2 = contracts["1.1.0"], contracts["2.0.0"]
sunset = str(v2["sunset_date"])

assert_compatible(v11, v2)

name = lambda suffix: fq(catalog, schema, f"{dataset}_{suffix}")  # noqa: E731
v1_name, archive, v2_table = name("v1"), name("v1_archive"), name("v2")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Move the old table aside
# MAGIC
# MAGIC The physical table is renamed so the name `customers_v1` can become a view.

# COMMAND ----------

spark.sql(f"ALTER TABLE {v1_name} RENAME TO {archive}")
archive_version = delta_version(spark, archive)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Publish the breaking shape as a new table

# COMMAND ----------

spark.sql(create_table_sql(v2, v2_table))
spark.sql(f"INSERT INTO {v2_table} SELECT {', '.join(migrate_select(v11, v2))} FROM {archive}")
register(spark, catalog, schema, dataset=dataset, version="2.0.0", change_type="breaking",
         object_name=f"{dataset}_v2", release=release, delta_ver=delta_version(spark, v2_table))
set_tags(spark, v2_table, {"contract_version": "2.0.0", "deprecated": "false"})

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Compatibility view
# MAGIC
# MAGIC The v1.1.0 shape over the v2 data, marked deprecated with a pointer to the migration.

# COMMAND ----------

migrate_msg = (f"DEPRECATED, removed after {sunset}. Migrate to {dataset}_v2: "
               "full_name -> display_name, lifetime_value (bigint dollars) -> lifetime_value_usd (decimal(18,2)).")
spark.sql(f"CREATE VIEW {v1_name} COMMENT '{migrate_msg}' AS "
          f"SELECT {', '.join(compat_view_select(v11, v2))} FROM {v2_table}")
deprecated_tags = {"contract_version": "1.1.0", "deprecated": "true", "sunset_date": sunset}
set_tags(spark, v1_name, deprecated_tags, view=True)
register(spark, catalog, schema, dataset=dataset, version="2.0.0", change_type="compatibility_view",
         object_name=f"{dataset}_v1", release=release, delta_ver=None)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Deprecate the archived table too

# COMMAND ----------

spark.sql(f"COMMENT ON TABLE {archive} IS '{migrate_msg} Archived physical v1.1.0 data.'")
set_tags(spark, archive, deprecated_tags)
register(spark, catalog, schema, dataset=dataset, version="1.1.0", change_type="deprecated",
         object_name=f"{dataset}_v1_archive", release=release, delta_ver=archive_version)

print(f"v2.0.0 published as {dataset}_v2; {dataset}_v1 is now a deprecated compatibility view (sunset {sunset}).")
display(spark.sql(f"SELECT * FROM {v1_name} LIMIT 5"))
display(spark.sql(f"SELECT * FROM {v2_table} LIMIT 5"))
