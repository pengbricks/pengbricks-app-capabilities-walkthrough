"""Authenticated, paginated REST client with token refresh, retries, and a request log.

The session is injected, so the loop is unit-tested with a fake session and no network.
The same code runs against the public DummyJSON API in the reference job.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def backoff_delay(attempt: int, base: float, cap: float = 30.0, retry_after: float | None = None) -> float:
    """Exponential backoff (base, 2*base, 4*base, ...) capped at `cap`. A server Retry-After wins."""
    if retry_after is not None:
        return min(retry_after, cap)
    return min(base * (2**attempt), cap)


class ApiError(RuntimeError):
    pass


@dataclass
class TokenManager:
    """Holds the bearer token and refreshes it before it expires or after a 401."""

    session: Any
    base_url: str
    username: str
    password: str
    refresh_after_seconds: float
    clock: Callable[[], float] = time.monotonic
    access_token: str = ""
    refresh_token: str = ""
    issued_at: float = 0.0
    logins: int = 0
    refreshes: int = 0

    def login(self) -> None:
        response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"username": self.username, "password": self.password, "expiresInMins": 30},
            timeout=30,
        )
        if response.status_code != 200:
            raise ApiError(f"login failed with HTTP {response.status_code}")
        body = response.json()
        self.access_token, self.refresh_token = body["accessToken"], body["refreshToken"]
        self.issued_at = self.clock()
        self.logins += 1

    def refresh(self) -> None:
        """Exchange the refresh token for a new access token; log in again if that fails."""
        response = self.session.post(
            f"{self.base_url}/auth/refresh",
            json={"refreshToken": self.refresh_token, "expiresInMins": 30},
            timeout=30,
        )
        if response.status_code == 200:
            body = response.json()
            self.access_token = body["accessToken"]
            self.refresh_token = body.get("refreshToken", self.refresh_token)
            self.issued_at = self.clock()
            self.refreshes += 1
        else:
            self.login()

    def header(self) -> dict[str, str]:
        if not self.access_token:
            self.login()
        elif self.clock() - self.issued_at >= self.refresh_after_seconds:
            self.refresh()
        return {"Authorization": f"Bearer {self.access_token}"}


@dataclass
class PageResult:
    records: list[dict[str, Any]]
    total: int
    log: list[dict[str, Any]] = field(default_factory=list)
    token_logins: int = 0
    token_refreshes: int = 0
    retries: int = 0


def fetch_all_pages(
    session: Any,
    tokens: TokenManager,
    url: str,
    records_key: str,
    page_size: int,
    max_retries: int = 5,
    backoff_base: float = 0.5,
    page_delay: float = 0.0,
    inject_invalid_token_on_page: int | None = None,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> PageResult:
    """Follow limit/skip pages until `skip` reaches the total the API reports.

    Each HTTP attempt gets one log row. A 401 refreshes the token and retries; 429 and 5xx
    retry with exponential backoff; any other 4xx stops the run.
    """
    result = PageResult(records=[], total=0)
    skip, page = 0, 0
    while True:
        page += 1
        attempt = 0  # retries used for backoff
        tries = 0  # HTTP attempts for this page, shown in the request log
        refreshed_on_401 = False
        inject = inject_invalid_token_on_page == page
        while True:
            headers = tokens.header()
            if inject:
                headers = {"Authorization": "Bearer invalid-token-for-reference-run"}
                inject = False
            tries += 1
            started = clock()
            status, body, error, retry_after = None, None, None, None
            try:
                response = session.get(
                    url, headers=headers, params={"limit": page_size, "skip": skip}, timeout=30
                )
                status = response.status_code
                if status == 200:
                    body = response.json()
                retry_after = _retry_after(response)
            except Exception as exc:  # network error: retry like a 5xx
                error = type(exc).__name__
            result.log.append(
                {
                    "page": page,
                    "skip": skip,
                    "limit": page_size,
                    "attempt": tries,
                    "http_status": status,
                    "error": error,
                    "records": len(body[records_key]) if body else 0,
                    "latency_ms": int((clock() - started) * 1000),
                    "token_refreshes": tokens.refreshes,
                }
            )
            if status == 200:
                break
            if status == 401 and not refreshed_on_401:
                refreshed_on_401 = True
                tokens.refresh()
                continue
            if status is not None and status not in RETRYABLE_STATUS:
                raise ApiError(f"page {page} failed with HTTP {status}")
            if attempt >= max_retries:
                raise ApiError(f"page {page} failed after {attempt + 1} attempts (status={status}, error={error})")
            result.retries += 1
            sleep(backoff_delay(attempt, backoff_base, retry_after=retry_after))
            attempt += 1

        records = body[records_key]
        result.records.extend(records)
        result.total = int(body["total"])
        skip += len(records)
        if not records or skip >= result.total:
            break
        if page_delay:
            sleep(page_delay)

    result.token_logins, result.token_refreshes = tokens.logins, tokens.refreshes
    return result


def _retry_after(response: Any) -> float | None:
    value = getattr(response, "headers", {}).get("Retry-After") if hasattr(response, "headers") else None
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
