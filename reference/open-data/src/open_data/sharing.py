"""Pure helpers for the data sharing guide."""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote, unquote, urlparse


def credential_profile(token: Any) -> dict[str, Any]:
    """Build a Delta Sharing profile (the open-sharing credential file) from a recipient activation response."""
    return {
        "shareCredentialsVersion": int(token.share_credentials_version or 1),
        "bearerToken": token.bearer_token,
        "endpoint": token.endpoint,
        "expirationTime": token.expiration_time,
    }


def activation_token(activation_url: str) -> str:
    """The one-time token is the query string of the activation link."""
    parsed = urlparse(activation_url)
    return unquote(parsed.query or parsed.path.rsplit("/", 1)[-1])


def activation_exchange_url(activation_url: str) -> str:
    """The public token-exchange endpoint on the host that issued the activation link.

    The link's host serves the exchange. On some clouds it is a regional open-sharing host, not the
    workspace, so the workspace API reports the activation nonce as not found.
    """
    parsed = urlparse(activation_url)
    token = quote(activation_token(activation_url), safe="")
    return f"{parsed.scheme}://{parsed.netloc}/api/2.1/unity-catalog/public/data_sharing_activation/{token}"


def file_urls(ndjson: str) -> list[str]:
    """Pull data file URLs out of a Delta Sharing /query response (newline-delimited JSON)."""
    urls = []
    for line in ndjson.splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        file = entry.get("file") or {}
        # Parquet-format responses carry file.url; Delta-format responses carry file.deltaSingleAction.add.path.
        url = file.get("url") or ((file.get("deltaSingleAction") or {}).get("add") or {}).get("path")
        if url:
            urls.append(url)
    return urls


def served_from_source(table_location: str, urls: list[str]) -> bool:
    """True when every shared file URL sits under the source table's own storage path.

    That is what "shared in place" means: the recipient reads the provider's files, not a copy.
    """
    if not urls:
        return False
    root = urlparse(table_location).path.strip("/")
    return all(root and root in urlparse(url).path for url in urls)


def needs_history_readd(status: Any) -> bool:
    """True when a shared table does not have history sharing enabled, so `ALTER SHARE ... ADD TABLE ... WITH HISTORY` must run.

    `status` is the SDK's history_data_sharing_status (an enum or its string); None means the table is not in the share.
    """
    return not str(status).endswith("ENABLED")


def strip_query(url: str) -> str:
    """Drop the pre-signed query string so no signature lands in a table."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def is_missing_privilege(message: str) -> bool:
    """True when an error says the identity lacks CREATE SHARE on the metastore."""
    return "PERMISSION_DENIED" in message and "CREATE SHARE" in message


AUDIT_EVENT_SQL = """
SELECT event_time, service_name, action_name,
       user_identity.email AS actor,
       response.status_code AS status_code,
       coalesce(request_params['name'], request_params['name_arg'], request_params['share'],
                request_params['recipient_name'], request_params['name_arg']) AS object_name,
       request_params['securable_type'] AS securable_type,
       request_params['privilege'] AS privilege,
       request_params['changes'] AS changes
FROM system.access.audit
WHERE event_time >= timestamp_seconds({started})
  AND service_name IN ('unityCatalog', 'deltaSharing')
  AND (to_json(request_params) LIKE '%{share}%' OR to_json(request_params) LIKE '%{recipient}%')
ORDER BY event_time
"""


def audit_event_query(started_epoch: int, share: str, recipient: str) -> str:
    """The audit query for one run, starting a minute before it began."""
    return AUDIT_EVENT_SQL.format(started=started_epoch - 60, share=share, recipient=recipient)


UNREADABLE_MARKERS = ("TABLE_OR_VIEW_NOT_FOUND", "SCHEMA_NOT_FOUND", "INSUFFICIENT_PERMISSIONS", "PERMISSION_DENIED")


def require_audit_table(spark: Any, query: str) -> str:
    """Return the query after checking system.access.audit is readable. Stops before anything changes."""
    try:
        spark.sql("SELECT 1 FROM system.access.audit LIMIT 1").collect()
    except Exception as error:
        if not any(marker in str(error) for marker in UNREADABLE_MARKERS):
            raise
        raise RuntimeError(
            "system.access.audit is not readable. Run (metastore admin): databricks system-schemas enable <metastore-id> access "
            "(get the ID from: databricks metastores current), then grant the job identity USE CATALOG on system, "
            "USE SCHEMA on system.access and SELECT on system.access.audit. Nothing was changed."
        ) from None
    return query
