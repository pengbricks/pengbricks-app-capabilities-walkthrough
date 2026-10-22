# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Share, read, revoke
# MAGIC
# MAGIC Open sharing: the recipient is a token recipient, so the read uses only the credential file and the `delta-sharing` client, the way a partner outside Databricks would. Safe to rerun: the share and recipient from an earlier run are dropped first, the recipient is dropped at the end, and the guide's rows in `sharing_audit` are replaced.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
from open_data.checks import append_rows, check_row, scrub
from open_data.sharing import activation_exchange_url, credential_profile, file_urls, is_missing_privilege, needs_history_readd, served_from_source, strip_query
from open_data.spec import load_spec
params = load_params(dbutils, "capability_guides_data_sharing", ['catalog', 'schema', 'use_case'])
catalog, schema = params["catalog"], params["schema"]
prefix = f"{catalog}.{schema}"
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"
import json, tempfile, time
import delta_sharing
import requests
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sharing import AuthenticationType, RetrieveTokenResponse

COLUMNS = ["guide", "check", "status", "value", "detail", "recorded_at"]
REVOKE_WAIT_SECONDS = 120
cfg = load_spec(SPEC_FILE)["sharing"]
share, recipient = cfg["share_name"], cfg["recipient_name"]
view, table = cfg["view_name"], cfg["shared_table"]
share_schema = "orders_share"  # the schema name the recipient sees
audit_table = f"{prefix}.sharing_audit"
rows, secrets = [], []


def record(check, status, value, detail):
    rows.append(check_row("data-sharing", check, status, detail, value=value))
    print(f"[{status}] {check}: {detail}")


def set_task_value(key, value):
    try:
        dbutils.jobs.taskValues.set(key=key, value=value)
    except Exception:
        pass  # standalone runs have no task to hand a value to


w = WorkspaceClient()
started = time.time()
set_task_value("started_epoch", int(started))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Clear leftovers
# MAGIC
# MAGIC Drops the share and recipient from an earlier run, so the steps below start clean.

# COMMAND ----------

spark.sql(f"DROP SHARE IF EXISTS {share}")
spark.sql(f"DROP RECIPIENT IF EXISTS {recipient}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Create the share
# MAGIC
# MAGIC Creating shares needs `CREATE SHARE` and `CREATE RECIPIENT` on the metastore. Without them this step records what is missing and stops before the protocol steps.

# COMMAND ----------

blocked = False
try:
    spark.sql(f"CREATE SHARE {share} COMMENT 'Governed orders share from the capability guides'")
except Exception as error:
    if not is_missing_privilege(str(error)):
        raise
    blocked = True
    me = w.current_user.me().user_name
    metastore = w.metastores.summary().name
    set_task_value("final_action", "createShare")
    record("share_created", "BLOCKED", "0", f"{me} lacks CREATE SHARE on metastore {metastore}. A metastore admin must run: GRANT CREATE SHARE, CREATE RECIPIENT ON METASTORE TO `{me}`. The steps below did not run in this workspace.")
    view_rows = spark.table(f"{prefix}.{view}").count()
    record("governed_view_ready", "PASS", str(view_rows), f"{prefix}.{view} limits orders to region {cfg['view_region']} ({view_rows} of {spark.table(f'{prefix}.sharing_orders').count()} rows) and omits customer_email")
    record("replication_required", "INFO", "false", "No, by design: Delta Sharing gives the recipient pre-signed URLs to the provider's own files, so the provider keeps one copy. Not verified in this workspace because the share could not be created.")
    append_rows(spark, audit_table, rows, COLUMNS, replace_where="guide = 'data-sharing'")
    print("Share not created; the remaining cells are skipped.")

if not blocked:
    set_task_value("final_action", "deleteRecipient")
    spark.sql(f"ALTER SHARE {share} ADD TABLE {prefix}.{table} COMMENT 'Product list prices' AS {share_schema}.{table}")
    spark.sql(f"ALTER SHARE {share} ADD VIEW {prefix}.{view} AS {share_schema}.{view}")
    listed = sorted(f"{r['type']}:{r['name']}" for r in spark.sql(f"SHOW ALL IN SHARE {share}").collect())
    record("share_created", "PASS", str(len(listed)), f"Share {share} exposes {', '.join(listed)}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Create the recipient and grant
# MAGIC
# MAGIC An open-sharing recipient uses a bearer token.

# COMMAND ----------

if not blocked:
    created = w.recipients.create(name=recipient, authentication_type=AuthenticationType.TOKEN, comment="Capability guide partner")
    url = created.tokens[0].activation_url
    record("recipient_created", "PASS", "TOKEN", f"Recipient {recipient} uses a bearer token (open sharing)")
    spark.sql(f"GRANT SELECT ON SHARE {share} TO RECIPIENT {recipient}")
    grants = spark.sql(f"SHOW GRANTS ON SHARE {share}").collect()
    record("grant", "PASS", str(len(grants)), f"SELECT on share {share} granted to recipient {recipient}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Exchange the activation link for a credential file
# MAGIC
# MAGIC The exchange is a public endpoint on the link's own host, as a real recipient would call it.

# COMMAND ----------

if not blocked:
    response = requests.get(activation_exchange_url(url), headers={"Accept": "application/json"}, timeout=30)
    response.raise_for_status()
    profile = credential_profile(RetrieveTokenResponse.from_dict(response.json()))
    secrets.append(profile["bearerToken"])
    profile_path = os.path.join(tempfile.mkdtemp(), "config.share")
    with open(profile_path, "w", encoding="utf-8") as handle:
        json.dump(profile, handle)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Read through the Delta Sharing protocol
# MAGIC
# MAGIC Only the credential file and the client. The view must be filtered and must not expose `customer_email`.

# COMMAND ----------

if not blocked:
    client = delta_sharing.SharingClient(profile_path)
    visible = sorted(f"{t.schema}.{t.name}" for t in client.list_all_tables())
    record("recipient_lists_tables", "PASS", str(len(visible)), f"Recipient sees {', '.join(visible)}")

    expected = spark.table(f"{prefix}.{view}").count()
    # A shared view is served from a materialized copy that can trail a changed source table for a while. Re-read until it catches up.
    for attempt in range(10):
        view_df = delta_sharing.load_as_pandas(f"{profile_path}#{share}.{share_schema}.{view}")
        if len(view_df) == expected:
            break
        time.sleep(60)
    ok = len(view_df) == expected and "customer_email" not in view_df.columns and set(view_df["region"]) == {cfg["view_region"]}
    record(
        "read_view_filtered", "PASS" if ok else "FAIL", str(len(view_df)),
        f"Read {len(view_df)} of {spark.table(f'{prefix}.sharing_orders').count()} orders rows; regions {sorted(set(view_df['region']))}; "
        f"columns {list(view_df.columns)}; customer_email absent: {'customer_email' not in view_df.columns}",
    )

    table_df = delta_sharing.load_as_pandas(f"{profile_path}#{share}.{share_schema}.{table}")
    source_rows = spark.table(f"{prefix}.{table}").count()
    record("read_table", "PASS" if len(table_df) == source_rows else "FAIL", str(len(table_df)), f"Read {len(table_df)} rows from {table}; source has {source_rows}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Check that nothing was replicated
# MAGIC
# MAGIC The pre-signed file URLs should point into the source table's own storage.

# COMMAND ----------

if not blocked:
    location = spark.sql(f"DESCRIBE DETAIL {prefix}.{table}").first()["location"]
    response = requests.post(
        f"{profile['endpoint'].rstrip('/')}/shares/{share}/schemas/{share_schema}/tables/{table}/query",
        headers={
            "Authorization": f"Bearer {profile['bearerToken']}",
            "Content-Type": "application/json",
            # Ask for Delta format: tables with deletion vectors or column mapping are only served that way.
            "delta-sharing-capabilities": "responseformat=delta;readerfeatures=deletionvectors,columnmapping",
        },
        data="{}",
        timeout=60,
    )
    if not response.ok:
        raise RuntimeError(f"Delta Sharing query returned {response.status_code}: {scrub(response.text[:500], secrets)}")
    urls = file_urls(response.text)
    in_place = served_from_source(location, urls)
    record(
        "replication_required", "PASS" if in_place else "FAIL", "false" if in_place else "true",
        f"No. {len(urls)} shared file URL(s) sit under the source table path {location}; "
        f"the provider created no copy. Example: {strip_query(urls[0]) if urls else 'none'}",
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Revoke, then show access fails

# COMMAND ----------

if not blocked:
    spark.sql(f"REVOKE SELECT ON SHARE {share} FROM RECIPIENT {recipient}")
    record("revoke", "PASS", "0", f"SELECT on share {share} revoked from {recipient}")
    deadline = time.time() + REVOKE_WAIT_SECONDS
    failure = None
    while time.time() < deadline:
        try:
            delta_sharing.load_as_pandas(f"{profile_path}#{share}.{share_schema}.{view}")
        except Exception as error:  # the client raises HTTP or runtime errors; any failure proves the point
            failure = scrub(f"{type(error).__name__}: {str(error)[:300]}", secrets)
            break
        time.sleep(5)
    record(
        "read_after_revoke", "PASS" if failure else "FAIL",
        "denied" if failure else "still readable",
        failure or f"The recipient could still read after {REVOKE_WAIT_SECONDS}s",
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## 7. Clean up the recipient
# MAGIC
# MAGIC Dropping the recipient invalidates its token. The share stays so its contents are inspectable.

# COMMAND ----------

if not blocked:
    w.recipients.delete(name=recipient)
    left = [r.name for r in w.recipients.list() if r.name == recipient]
    record("recipient_removed", "PASS" if not left else "FAIL", str(len(left)), f"Recipient {recipient} dropped; credential file is invalid")
    os.remove(profile_path)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 8. Share the table with history
# MAGIC
# MAGIC `WITH HISTORY` lets a recipient run time travel and streaming reads, and change data feed queries when the table has CDF on. For Databricks-to-Databricks recipients it also lets reads use cloud tokens instead of pre-signed URLs. The docs say the default is `WITH HISTORY` on Databricks Runtime 16.2 and above. This step does not rely on the default. It reads the share's metadata through the SDK (the `history_data_sharing_status` field of each shared object; `SHOW ALL IN SHARE` shows the same value in its `history_sharing` column) and runs `ALTER SHARE ... ADD TABLE ... WITH HISTORY` only when history is off. That statement is the documented way to turn history on for a table already in the share. The recipient in this guide is an open recipient and is already dropped, so the step shows the provider side: the share metadata and the table versions a history-enabled recipient could query. Safe to rerun: a table that already has history is left alone.

# COMMAND ----------

if not blocked:
    def history_status(share_name, shared_as):
        info = w.shares.get(name=share_name, include_shared_data=True)
        for obj in info.objects or []:
            if obj.shared_as == shared_as or obj.name.endswith(f".{shared_as.rsplit('.', 1)[-1]}"):
                return obj.history_data_sharing_status, obj.start_version
        return None, None

    shared_as = f"{share_schema}.{table}"
    status, _ = history_status(share, shared_as)
    if needs_history_readd(status):
        spark.sql(f"ALTER SHARE {share} ADD TABLE {prefix}.{table} COMMENT 'Product list prices' AS {shared_as} WITH HISTORY")
    status, start_version = history_status(share, shared_as)
    record("history_shared", "PASS" if str(status).endswith("ENABLED") else "FAIL", str(status), f"{shared_as} in share {share}: history sharing {status}, start version {start_version}")
    versions = spark.sql(f"DESCRIBE HISTORY {prefix}.{table}").select("version", "timestamp", "operation").orderBy("version").collect()
    record("history_versions", "INFO", str(len(versions)), f"A history-enabled recipient can time travel across {len(versions)} version(s) of {table}, from version {versions[0]['version']} to {versions[-1]['version']}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results

# COMMAND ----------

if not blocked:
    append_rows(spark, audit_table, rows, COLUMNS, replace_where="guide = 'data-sharing'")
    failed = [r["check"] for r in rows if r["status"] == "FAIL"]
    if failed:
        raise Exception(f"Failed checks: {failed}")
display(spark.table(audit_table))
