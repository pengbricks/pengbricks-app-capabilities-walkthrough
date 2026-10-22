# Databricks notebook source
# MAGIC %md
# MAGIC # SFTP file retrieval
# MAGIC
# MAGIC This guide stores SFTP credentials in a secret scope, copies only the files it has not copied before to a Unity Catalog volume, ingests them with Auto Loader in a Lakeflow Declarative Pipeline, and proves that a second fetch finds nothing new. Safe to rerun: the secret scope is reused, only files not yet in the transfer log are copied, and Auto Loader skips files it has read, so a second run adds no rows to the data tables. Only the transfer log and run log grow.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | What it does |
# MAGIC |---|---|
# MAGIC | `01_setup_secrets` | Creates the secret scope and stores the SFTP credentials. Safe to repeat. |
# MAGIC | `02_fetch_files` | Lists the server, copies new files to `source_landing/sftp`, and logs each transfer. |
# MAGIC | `03_run_pipeline` | Starts a pipeline update (by hand) or inspects the job's update, and shows the two streaming tables. |
# MAGIC | `04_refetch_finds_nothing` | Fetches again and fails if anything is copied twice. |
# MAGIC | `05_verify_tables` | Fails if copied and ingested file counts differ. |
# MAGIC
# MAGIC ## How to run
# MAGIC
# MAGIC Run the job `capability-guides-sftp` (or **Quick run** in the app). To run by hand, open the notebooks in order and use Run all in each.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for the tables and the `source_landing` volume. |
# MAGIC | `use_case` | Spec under `use_cases/` that drives the data, sources and checks. |
# MAGIC | `run_pipeline` | `true` starts a pipeline update and waits for it. The job sets it to `false` because its pipeline task already ran. Defaults to `true` when run by hand. |
# MAGIC | `run_id` | Set by the job on the notebooks that log results. Defaults to `manual` when run by hand. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name. Type a value to override it for one run.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Required setup
# MAGIC
# MAGIC Run these once, before the job. `<principal>` is the person or service principal behind `databricks bundle run`.
# MAGIC
# MAGIC 1. **An SFTP server the job can reach.** The default is the public test server `test.rebex.net` on port 22, with the published `demo` login. Serverless and classic compute need outbound access to the host and port. If the workspace restricts serverless egress, add the host to the allowed destinations of its network policy (set in the account console; see [network policies](https://docs.databricks.com/aws/en/security/network/serverless-network-security/network-policies)). When the server is unreachable, `fetch_files` copies from a folder in the volume instead and records mode `volume_fallback`, so the job still passes but does not prove an SFTP read.
# MAGIC 2. **Your own server.** Set `sftp.host`, `sftp.port`, `sftp.username`, `sftp.password`, and `sftp.remote_roots` in `use_cases/general.yml`, then redeploy. `01_setup_secrets` writes those values to the scope on every run, so editing the secret by hand does not last.
# MAGIC 3. **Secret scope.** `01_setup_secrets` creates the scope `capability-guides` and writes the keys `sftp-username` and `sftp-password`. The job identity must be allowed to create secret scopes, and it gets MANAGE on the scope it creates. If an admin restricts scope creation, create it first and give the job identity WRITE on it:
# MAGIC    ```bash
# MAGIC    databricks secrets create-scope capability-guides
# MAGIC    databricks secrets put-acl capability-guides <principal> WRITE
# MAGIC    ```

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params, JOB_TAG
JOB_KEY = "capability_guides_sftp"
params = load_params(dbutils, JOB_KEY, ['catalog', 'schema', 'use_case'])

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()
host = w.config.host.rstrip("/")
links = []
for job in w.jobs.list():
    if ((job.settings.tags if job.settings else None) or {}).get(JOB_TAG) == JOB_KEY:
        links.append(f'<li>Job <b>{job.settings.name}</b>: <a href="{host}/jobs/{job.job_id}">open</a></li>')

pipelines = [p for p in w.pipelines.list_pipelines() if "capability-guides-sftp" in (p.name or "")]
for p in pipelines:
    links.append(f'<li>Pipeline <b>{p.name}</b>: <a href="{host}/pipelines/{p.pipeline_id}">open</a></li>')

displayHTML("<ul>" + "".join(links) + "</ul>" if links else "No deployed job is tagged " + JOB_KEY + ". Deploy the bundle first.")
