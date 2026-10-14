"""Share, grant, read through the Delta Sharing protocol, revoke, and show that access fails.

Open sharing: the recipient is a token recipient, so the read below uses only the credential
file and the `delta-sharing` client, the way a partner outside Databricks would.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import time

from open_data.checks import append_rows, check_row, scrub
from open_data.sharing import activation_token, credential_profile, file_urls, served_from_source, strip_query
from open_data.spec import load_spec

COLUMNS = ["guide", "check", "status", "value", "detail", "recorded_at"]
REVOKE_WAIT_SECONDS = 120


def is_missing_privilege(message: str) -> bool:
    return "PERMISSION_DENIED" in message and "CREATE SHARE" in message


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()

    import delta_sharing
    import requests
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.runtime import dbutils, spark

    spec = load_spec(args.use_case_file)
    cfg = spec["sharing"]
    prefix = f"{args.catalog}.{args.schema}"
    share, recipient = cfg["share_name"], cfg["recipient_name"]
    view, table = cfg["view_name"], cfg["shared_table"]
    # Names the recipient sees. They do not carry the provider's schema name.
    share_schema = "orders_share"
    audit_table = f"{prefix}.sharing_audit"
    rows: list[dict] = []
    secrets: list[str] = []

    def record(check: str, status: str, value: str, detail: str) -> None:
        rows.append(check_row("data-sharing", check, status, detail, value=value))
        print(f"[{status}] {check}: {detail}")

    w = WorkspaceClient()
    started = time.time()
    dbutils.jobs.taskValues.set(key="started_epoch", value=int(started))

    # Rerunnable: remove leftovers from an earlier run.
    spark.sql(f"DROP SHARE IF EXISTS {share}")
    spark.sql(f"DROP RECIPIENT IF EXISTS {recipient}")

    # 1. Share with a table and a view. Creating shares needs CREATE SHARE and CREATE RECIPIENT on the
    #    metastore. Without them the task records what is missing and stops before the protocol steps.
    try:
        spark.sql(f"CREATE SHARE {share} COMMENT 'Governed orders share from the capability guides'")
    except Exception as error:
        if not is_missing_privilege(str(error)):
            raise
        me = w.current_user.me().user_name
        metastore = w.metastores.summary().name
        dbutils.jobs.taskValues.set(key="final_action", value="createShare")
        record("share_created", "BLOCKED", "0", f"{me} lacks CREATE SHARE on metastore {metastore}. A metastore admin must run: GRANT CREATE SHARE, CREATE RECIPIENT ON METASTORE TO `{me}`. The steps below did not run in this workspace.")
        view_rows = spark.table(f"{prefix}.{view}").count()
        record("governed_view_ready", "PASS", str(view_rows), f"{prefix}.{view} limits orders to region {cfg['view_region']} ({view_rows} of {spark.table(f'{prefix}.orders').count()} rows) and omits customer_email")
        record("replication_required", "INFO", "false", "No, by design: Delta Sharing gives the recipient pre-signed URLs to the provider's own files, so the provider keeps one copy. Not verified in this workspace because the share could not be created.")
        append_rows(spark, audit_table, rows, COLUMNS, replace_where="guide = 'data-sharing'")
        return
    dbutils.jobs.taskValues.set(key="final_action", value="deleteRecipient")
    spark.sql(f"ALTER SHARE {share} ADD TABLE {prefix}.{table} AS {share_schema}.{table} COMMENT 'Product list prices'")
    spark.sql(f"ALTER SHARE {share} ADD VIEW {prefix}.{view} AS {share_schema}.{view}")
    objects = spark.sql(f"SHOW ALL IN SHARE {share}").collect()
    listed = sorted(f"{r['type']}:{r['name']}" for r in objects)
    record("share_created", "PASS", str(len(listed)), f"Share {share} exposes {', '.join(listed)}")

    # 2. Open-sharing recipient (token), then grant.
    created = w.recipients.create(name=recipient, authentication_type="TOKEN", comment="Capability guide partner")
    url = created.tokens[0].activation_url
    record("recipient_created", "PASS", "TOKEN", f"Recipient {recipient} uses a bearer token (open sharing)")
    spark.sql(f"GRANT SELECT ON SHARE {share} TO RECIPIENT {recipient}")
    grants = spark.sql(f"SHOW GRANTS ON SHARE {share}").collect()
    record("grant", "PASS", str(len(grants)), f"SELECT on share {share} granted to recipient {recipient}")

    # 3. The recipient exchanges the one-time link for a credential file.
    token = w.recipient_activation.retrieve_token(activation_url=activation_token(url))
    profile = credential_profile(token)
    secrets.append(profile["bearerToken"])
    profile_path = os.path.join(tempfile.mkdtemp(), "config.share")
    with open(profile_path, "w", encoding="utf-8") as handle:
        json.dump(profile, handle)

    # 4. Read through the Delta Sharing protocol with the credential only.
    client = delta_sharing.SharingClient(profile_path)
    visible = sorted(f"{t.schema}.{t.name}" for t in client.list_all_tables())
    record("recipient_lists_tables", "PASS", str(len(visible)), f"Recipient sees {', '.join(visible)}")

    view_df = delta_sharing.load_as_pandas(f"{profile_path}#{share}.{share_schema}.{view}")
    expected = spark.table(f"{prefix}.{view}").count()
    ok = len(view_df) == expected and "customer_email" not in view_df.columns and set(view_df["region"]) == {cfg["view_region"]}
    record(
        "read_view_filtered",
        "PASS" if ok else "FAIL",
        str(len(view_df)),
        f"Read {len(view_df)} of {spark.table(f'{prefix}.orders').count()} orders rows; regions {sorted(set(view_df['region']))}; "
        f"columns {list(view_df.columns)}; customer_email absent: {'customer_email' not in view_df.columns}",
    )

    table_df = delta_sharing.load_as_pandas(f"{profile_path}#{share}.{share_schema}.{table}")
    source_rows = spark.table(f"{prefix}.{table}").count()
    record("read_table", "PASS" if len(table_df) == source_rows else "FAIL", str(len(table_df)), f"Read {len(table_df)} rows from {table}; source has {source_rows}")

    # 5. Replication check: the pre-signed file URLs point into the source table's own storage.
    location = spark.sql(f"DESCRIBE DETAIL {prefix}.{table}").first()["location"]
    response = requests.post(
        f"{profile['endpoint'].rstrip('/')}/shares/{share}/schemas/{share_schema}/tables/{table}/query",
        headers={"Authorization": f"Bearer {profile['bearerToken']}", "Content-Type": "application/json"},
        data="{}",
        timeout=60,
    )
    response.raise_for_status()
    urls = file_urls(response.text)
    in_place = served_from_source(location, urls)
    record(
        "replication_required",
        "PASS" if in_place else "FAIL",
        "false" if in_place else "true",
        f"No. {len(urls)} shared file URL(s) sit under the source table path {location}; "
        f"the provider created no copy. Example: {strip_query(urls[0]) if urls else 'none'}",
    )

    # 6. Revoke, then show access fails.
    spark.sql(f"REVOKE SELECT ON SHARE {share} FROM RECIPIENT {recipient}")
    record("revoke", "PASS", "0", f"SELECT on share {share} revoked from {recipient}")
    deadline = time.time() + REVOKE_WAIT_SECONDS
    failure, waited = None, 0.0
    while time.time() < deadline:
        try:
            delta_sharing.load_as_pandas(f"{profile_path}#{share}.{share_schema}.{view}")
        except Exception as error:  # the client raises HTTP or runtime errors; any failure proves the point
            failure, waited = scrub(f"{type(error).__name__}: {str(error)[:300]}", secrets), time.time() - started
            break
        time.sleep(5)
    record(
        "read_after_revoke",
        "PASS" if failure else "FAIL",
        "denied" if failure else "still readable",
        failure or f"The recipient could still read after {REVOKE_WAIT_SECONDS}s",
    )

    # 7. Clean up the recipient; its token stops working. The share stays so its contents are inspectable.
    w.recipients.delete(name=recipient)
    left = [r.name for r in w.recipients.list() if r.name == recipient]
    record("recipient_removed", "PASS" if not left else "FAIL", str(len(left)), f"Recipient {recipient} dropped; credential file is invalid")
    os.remove(profile_path)

    append_rows(spark, audit_table, rows, COLUMNS, replace_where="guide = 'data-sharing'")
    failed = [r["check"] for r in rows if r["status"] == "FAIL"]
    if failed:
        raise SystemExit(f"Failed checks: {failed}")


if __name__ == "__main__":
    main()
