# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Fetch new files
# MAGIC
# MAGIC Copies files that are not in `sftp_transfer_log` to the volume under `sftp/`, keeping the remote folder layout, and logs each transfer in `sftp_transfer_log` and each run in `sftp_transfer_runs`. Safe to rerun: files already in the transfer log are skipped, so a second run copies nothing, and the run log keeps one row per run and task.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_sftp", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Fetch
# MAGIC
# MAGIC `fetch_new_files` (in `src/source_ingestion/sftp_fetch.py`) connects with the credentials from the secret scope, lists the remote roots, and plans transfers with `plan_transfers`: a file is new when its (path, size, mtime) is not in `sftp_transfer_log`. If the server is unreachable, the same logic runs against a folder in the volume and the run records mode `volume_fallback` with the connection error.

# COMMAND ----------

from source_ingestion.sftp_fetch import fetch_new_files
from source_ingestion.spec import load_spec

cfg = load_spec(SPEC_FILE)["sftp"]
copied = fetch_new_files(
    spark, dbutils, cfg, catalog, schema, run_id=params["run_id"], task="fetch_files", allow_volume_fallback=True,
)
print(f'copied {len(copied)} new files')
