# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Set up the secret scope
# MAGIC
# MAGIC Creates the secret scope and stores the SFTP credentials. Safe to run repeatedly.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_sftp", ['use_case'])
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the scope and write the secrets

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import ResourceAlreadyExists
from source_ingestion.spec import load_spec

cfg = load_spec(SPEC_FILE)["sftp"]
w = WorkspaceClient()
try:
    w.secrets.create_scope(scope=cfg["secret_scope"])
    print(f"Created secret scope {cfg['secret_scope']}")
except ResourceAlreadyExists:
    print(f"Secret scope {cfg['secret_scope']} already exists")
# The reference server publishes these credentials. A real server's values go in the same keys.
w.secrets.put_secret(scope=cfg["secret_scope"], key="sftp-username", string_value=cfg["username"])
w.secrets.put_secret(scope=cfg["secret_scope"], key="sftp-password", string_value=cfg["password"])
keys = sorted(s.key for s in w.secrets.list_secrets(scope=cfg["secret_scope"]))
print(f"Keys in scope: {keys}")
