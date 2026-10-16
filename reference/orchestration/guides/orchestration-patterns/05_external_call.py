# Databricks notebook source
# MAGIC %md
# MAGIC # 5. Call an external process
# MAGIC
# MAGIC Runs a shell command from Python and an HTTP request to a public endpoint.
# MAGIC
# MAGIC The job sets `fail_first_attempt = true`, so attempt 0 fails on purpose and the task retry policy runs it again. A marker row per job run tells the second attempt that it is a retry. Run by hand, `fail_first_attempt` defaults to `false`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_orchestration", ['catalog', 'schema', 'use_case', 'run_id', 'fail_first_attempt'],
                     defaults={'run_id': 'manual', 'fail_first_attempt': 'false'})
prefix = f"{params['catalog']}.{params['schema']}"
run_id = params["run_id"]

import guide_lib as g
spec = g.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Fail the first attempt, once per run

# COMMAND ----------

spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.orch_attempt_marker (job_run_id STRING, marked_at TIMESTAMP)")
seen = spark.sql(f"SELECT COUNT(*) FROM {prefix}.orch_attempt_marker WHERE job_run_id = '{run_id}'").first()[0]
if params["fail_first_attempt"].lower() == "true" and seen == 0:
    spark.sql(f"INSERT INTO {prefix}.orch_attempt_marker VALUES ('{run_id}', current_timestamp())")
    raise RuntimeError("Simulated transient failure on the first attempt; the retry policy runs this task again.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Shell command and HTTP request

# COMMAND ----------

import subprocess
import time
import urllib.request

def http_get(url: str, timeout: int = 20) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "capability-guides"})
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed https URL from the spec
        return response.status, response.read(200).decode("utf-8", "replace").strip()

url = spec["orchestration"]["http_probe_url"]
shell = subprocess.run(["python3", "--version"], capture_output=True, text=True, check=True)
shell_out = (shell.stdout or shell.stderr).strip()

started = time.time()
status, body = http_get(url)
elapsed_ms = int((time.time() - started) * 1000)

# COMMAND ----------

spark.sql(
    f"""
    CREATE TABLE IF NOT EXISTS {prefix}.orch_external_calls
    (job_run_id STRING, kind STRING, target STRING, result STRING, elapsed_ms BIGINT, called_at TIMESTAMP)
    """
)
spark.sql(f"DELETE FROM {prefix}.orch_external_calls WHERE job_run_id = '{run_id}'")
rows = [
    (run_id, "shell", "python3 --version", shell_out, 0),
    (run_id, "http", url, f"HTTP {status}: {body[:120]}", elapsed_ms),
]
df = spark.createDataFrame(rows, "job_run_id STRING, kind STRING, target STRING, result STRING, elapsed_ms BIGINT")
df.selectExpr("*", "current_timestamp() AS called_at").write.mode("append").saveAsTable(f"{prefix}.orch_external_calls")
dbutils.jobs.taskValues.set(key="http_status", value=status)
print(f"external: shell -> {shell_out}; http {status} in {elapsed_ms} ms")
