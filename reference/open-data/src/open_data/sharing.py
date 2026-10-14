"""Pure helpers for the data sharing guide."""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlparse


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
    return parsed.query or parsed.path.rsplit("/", 1)[-1]


def file_urls(ndjson: str) -> list[str]:
    """Pull data file URLs out of a Delta Sharing /query response (newline-delimited JSON)."""
    urls = []
    for line in ndjson.splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        url = (entry.get("file") or {}).get("url")
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


def strip_query(url: str) -> str:
    """Drop the pre-signed query string so no signature lands in a table."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
