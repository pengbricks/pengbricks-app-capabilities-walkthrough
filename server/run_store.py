"""Optional Lakebase run history for guide artifacts.

Each deployment binds to the Lakebase database in its own workspace through:
  CAPABILITY_GUIDES_LAKEBASE_ENDPOINT  endpoint resource path (valueFrom: postgres)
  CAPABILITY_GUIDES_LAKEBASE_DATABASE  logical PostgreSQL database name (default databricks_postgres)
  CAPABILITY_GUIDES_LAKEBASE_SCHEMA    app-owned schema (default capability_guides)
When the endpoint is not configured, the app still works and reads run history from the Jobs API only.
"""

from __future__ import annotations

import logging
import os
import re
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

TOKEN_TTL_SECONDS = 30 * 60
SCHEMA_PATTERN = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


@dataclass(frozen=True)
class RunRecord:
    guide_slug: str
    job_key: str
    job_id: int
    run_id: int
    run_url: str
    life_cycle_state: str | None
    result_state: str | None
    trigger: str | None
    triggered_via: str
    started_at: datetime | None


class RunStore:
    def __init__(self, workspace_client_factory) -> None:
        self._workspace_client_factory = workspace_client_factory
        self.endpoint = os.environ.get("CAPABILITY_GUIDES_LAKEBASE_ENDPOINT", "").strip()
        # Every Lakebase branch creates databricks_postgres; deployments that only inject the
        # endpoint (for example through app.yaml valueFrom) use it.
        self.database = os.environ.get("CAPABILITY_GUIDES_LAKEBASE_DATABASE", "").strip() or "databricks_postgres"
        self.schema = os.environ.get("CAPABILITY_GUIDES_LAKEBASE_SCHEMA", "capability_guides").strip()
        if not SCHEMA_PATTERN.match(self.schema):
            raise ValueError("CAPABILITY_GUIDES_LAKEBASE_SCHEMA must be a lowercase PostgreSQL identifier")
        self._lock = threading.Lock()
        self._credential: tuple[str, str, str, float] | None = None  # host, user, token, expiry
        self._initialized = False

    @property
    def enabled(self) -> bool:
        return bool(self.endpoint)

    def _connection_settings(self) -> tuple[str, str, str]:
        with self._lock:
            if self._credential and self._credential[3] > time.time():
                host, user, token, _ = self._credential
                return host, user, token
            w = self._workspace_client_factory()
            endpoint = w.api_client.do("GET", f"/api/2.0/postgres/{self.endpoint}")
            host = endpoint["status"]["hosts"]["host"]
            token = w.api_client.do("POST", "/api/2.0/postgres/credentials", body={"endpoint": self.endpoint})["token"]
            user = w.config.client_id or w.current_user.me().user_name
            self._credential = (host, user, token, time.time() + TOKEN_TTL_SECONDS)
            return host, user, token

    def _connect(self):
        import psycopg

        host, user, token = self._connection_settings()
        return psycopg.connect(
            host=host,
            port=int(os.environ.get("PGPORT", "5432")),
            dbname=self.database,
            user=user,
            password=token,
            sslmode="require",
            connect_timeout=10,
        )

    def _ensure_schema(self, conn) -> None:
        if self._initialized:
            return
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", (self.schema,))
            if cur.fetchone() is None:
                cur.execute(f'CREATE SCHEMA "{self.schema}"')
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS "{self.schema}".guide_runs (
                  run_id BIGINT PRIMARY KEY,
                  guide_slug TEXT NOT NULL,
                  job_key TEXT NOT NULL,
                  job_id BIGINT NOT NULL,
                  run_url TEXT NOT NULL,
                  life_cycle_state TEXT,
                  result_state TEXT,
                  trigger TEXT,
                  triggered_via TEXT NOT NULL,
                  started_at TIMESTAMPTZ,
                  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cur.execute(
                f'CREATE INDEX IF NOT EXISTS guide_runs_guide_idx ON "{self.schema}".guide_runs (guide_slug, started_at DESC)'
            )
        conn.commit()
        self._initialized = True

    def record(self, records: list[RunRecord]) -> None:
        """Upsert observed runs. Quick-run provenance is never overwritten by later observations."""
        if not self.enabled or not records:
            return
        with self._connect() as conn:
            self._ensure_schema(conn)
            with conn.cursor() as cur:
                cur.executemany(
                    f"""
                    INSERT INTO "{self.schema}".guide_runs
                      (run_id, guide_slug, job_key, job_id, run_url, life_cycle_state, result_state, trigger,
                       triggered_via, started_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (run_id) DO UPDATE SET
                      life_cycle_state = EXCLUDED.life_cycle_state,
                      result_state = EXCLUDED.result_state,
                      updated_at = now(),
                      triggered_via = CASE WHEN "{self.schema}".guide_runs.triggered_via = 'quick-run'
                                           THEN 'quick-run' ELSE EXCLUDED.triggered_via END
                    """,
                    [
                        (
                            r.run_id, r.guide_slug, r.job_key, r.job_id, r.run_url, r.life_cycle_state,
                            r.result_state, r.trigger, r.triggered_via, r.started_at,
                        )
                        for r in records
                    ],
                )
            conn.commit()

    def history(self, guide_slug: str, limit: int = 20) -> list[dict[str, Any]]:
        if not self.enabled:
            return []
        with self._connect() as conn:
            self._ensure_schema(conn)
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT run_id, job_key, run_url, life_cycle_state, result_state, triggered_via, started_at
                    FROM "{self.schema}".guide_runs
                    WHERE guide_slug = %s
                    ORDER BY started_at DESC NULLS LAST
                    LIMIT %s
                    """,
                    (guide_slug, limit),
                )
                columns = [column.name for column in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
