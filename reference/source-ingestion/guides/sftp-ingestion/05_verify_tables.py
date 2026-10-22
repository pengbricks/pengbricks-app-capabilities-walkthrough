# Databricks notebook source
# MAGIC %md
# MAGIC # 5. Verify the tables
# MAGIC
# MAGIC Checks that the ingested tables match the files copied from SFTP: every copied file appears exactly once. Safe to rerun: it only reads.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_sftp", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

def n(sql: str) -> int:
    return spark.sql(sql).first()[0]

logged = {k: n(f"SELECT count(DISTINCT remote_path) FROM {ns}.sftp_transfer_log WHERE kind = '{k}'") for k in ("text", "binary")}
ingested = {
    "text": n(f"SELECT count(DISTINCT source_file) FROM {ns}.sftp_text_files"),
    "binary": n(f"SELECT count(DISTINCT path) FROM {ns}.sftp_binary_files"),
}
total_rows = {"text": n(f"SELECT count(*) FROM {ns}.sftp_text_files"), "binary": n(f"SELECT count(*) FROM {ns}.sftp_binary_files")}
print(f"copied (distinct files): {logged}; ingested (distinct files): {ingested}; rows: {total_rows}")
for kind in ("text", "binary"):
    assert logged[kind] > 0, f"no {kind} files were copied"
    assert logged[kind] == ingested[kind] == total_rows[kind], f"{kind}: copied {logged[kind]}, ingested {ingested[kind]}, rows {total_rows[kind]}"
print("Every copied file was ingested exactly once")
