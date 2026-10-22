from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import lakebase_lib as lb  # noqa: E402


# ---------- names ----------


def test_resource_names_nest():
    assert lb.endpoint_name("my-app", "production", "primary") == "projects/my-app/branches/production/endpoints/primary"


@pytest.mark.parametrize("bad", ["", "My-App", "1app", "a_b", "a b", "x" * 64])
def test_bad_resource_ids_are_rejected(bad):
    with pytest.raises(ValueError):
        lb.resource_id(bad)


@pytest.mark.parametrize("bad", ["", "a-b", "1a", "a; DROP TABLE x", "a b"])
def test_bad_identifiers_are_rejected(bad):
    with pytest.raises(ValueError):
        lb.ident(bad)


def test_ttl_text():
    assert lb.ttl_text(1) == "3600s"
    assert lb.ttl_text(0.5) == "1800s"
    with pytest.raises(ValueError):
        lb.ttl_text(0)


# ---------- token timing ----------


def test_token_is_fresh_until_two_minutes_before_expiry():
    assert not lb.token_needs_refresh(issued_at=1000, now=1000)
    assert not lb.token_needs_refresh(issued_at=1000, now=1000 + 3600 - 121)
    assert lb.token_needs_refresh(issued_at=1000, now=1000 + 3600 - 120)
    assert lb.token_needs_refresh(issued_at=1000, now=1000 + 7200)


def test_seconds_until_refresh_never_goes_negative():
    assert lb.seconds_until_refresh(0, 0) == 3480
    assert lb.seconds_until_refresh(0, 3000) == 480
    assert lb.seconds_until_refresh(0, 9999) == 0


def test_pool_connections_recycle_well_inside_the_token_and_server_limits():
    assert lb.pool_max_lifetime() == 1800
    assert lb.pool_max_lifetime(600) == 300


# ---------- retry ----------


def test_retry_delays_double_and_cap():
    policy = lb.RetryPolicy(attempts=6, base_delay=0.5, factor=2, max_delay=4)
    assert list(policy.delays()) == [0.5, 1.0, 2.0, 4.0, 4.0]
    assert policy.total_wait() == 11.5
    assert list(lb.RetryPolicy(attempts=1).delays()) == []


def test_wake_up_errors_are_retried_and_auth_errors_are_not():
    assert lb.is_wake_up_error(Exception("connection refused"))
    assert lb.is_wake_up_error(Exception("FATAL: the database system is starting up"))
    assert lb.is_wake_up_error(Exception("server closed the connection unexpectedly"))
    assert not lb.is_wake_up_error(Exception("FATAL: password authentication failed for user x"))
    assert not lb.is_wake_up_error(Exception('FATAL: role "x" does not exist'))
    assert not lb.is_wake_up_error(Exception("syntax error at or near SELEC"))


def test_retry_call_waits_out_a_compute_that_is_resuming():
    calls, slept = [], []

    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise ConnectionError("connection refused")
        return "ok"

    assert lb.retry_call(flaky, sleep=slept.append) == "ok"
    assert len(calls) == 3
    assert slept == [0.5, 1.0]


def test_retry_call_gives_up_after_the_last_attempt():
    slept = []
    with pytest.raises(ConnectionError):
        lb.retry_call(lambda: (_ for _ in ()).throw(ConnectionError("connection refused")), lb.RetryPolicy(attempts=3), sleep=slept.append)
    assert len(slept) == 2


def test_retry_call_does_not_retry_other_errors():
    calls = []

    def bad():
        calls.append(1)
        raise ValueError("syntax error")

    with pytest.raises(ValueError):
        lb.retry_call(bad, sleep=lambda _: None)
    assert calls == [1]


def test_wait_until_returns_when_done_and_times_out_otherwise():
    values = iter(["A", "A", "B"])
    now = [0.0]
    ticks = lambda s: now.__setitem__(0, now[0] + s)  # noqa: E731
    assert lb.wait_until(lambda: next(values), lambda v: v == "B", 100, 5, sleep=ticks, clock=lambda: now[0]) == "B"
    with pytest.raises(TimeoutError):
        lb.wait_until(lambda: "A", lambda v: v == "B", 10, 5, sleep=ticks, clock=lambda: now[0])
    with pytest.raises(RuntimeError, match="failed"):
        lb.wait_until(lambda: "X", lambda v: False, 10, 5, sleep=ticks, clock=lambda: now[0], failed=lambda v: v == "X")


# ---------- connection strings ----------


def test_conninfo_has_no_password_and_requires_ssl():
    text = lb.conninfo("ep-1.database.example.com", "me@example.com")
    assert "password" not in text
    assert text == "dbname=databricks_postgres user=me@example.com host=ep-1.database.example.com port=5432 sslmode=require"


def test_conninfo_rejects_empty_or_spaced_values():
    with pytest.raises(ValueError):
        lb.conninfo("", "me")
    with pytest.raises(ValueError):
        lb.conninfo("host", "me; sslmode=disable")


def test_pooled_host_inserts_pooler_once():
    assert lb.pooled_host("ep-abc.database.us-west-2.cloud.databricks.com") == "ep-abc-pooler.database.us-west-2.cloud.databricks.com"
    assert lb.pooled_host("ep-abc-pooler.database.x") == "ep-abc-pooler.database.x"


# ---------- create or reuse ----------


def test_decide_covers_each_outcome():
    assert lb.decide(None, ["READY"]) == "create"
    assert lb.decide("ready", ["READY"]) == "reuse"
    assert lb.decide("INIT", ["READY"], in_progress=["INIT"]) == "wait"
    assert lb.decide("FAILED", ["READY"], broken=["FAILED"]) == "recreate"
    assert lb.decide("SOMETHING_NEW", ["READY"]) == "wait"


def test_synced_table_action():
    assert lb.synced_table_action(None) == "create"
    assert lb.synced_table_action("SYNCED_TABLE_ONLINE") == "reuse"
    assert lb.synced_table_action("SYNCED_TABLE_PROVISIONING_INITIAL_SNAPSHOT") == "wait"
    assert lb.synced_table_action("SYNCED_TABLE_ONLINE_PIPELINE_FAILED") == "recreate"


def test_branch_action_always_starts_from_a_clean_branch():
    assert lb.branch_action(None) == "create"
    assert lb.branch_action("DELETED") == "create"
    assert lb.branch_action("READY") == "recreate"


def test_cdf_action_reuses_the_config_for_a_schema():
    configs = [{"postgres_schema": "lakebase_apps"}]
    assert lb.cdf_action(configs, "lakebase_apps") == "reuse"
    assert lb.cdf_action(configs, "other") == "create"
    assert lb.cdf_action([], "lakebase_apps") == "create"


def test_catalog_action():
    assert lb.catalog_action(True) == "reuse"
    assert lb.catalog_action(False) == "create"


def test_cleanup_does_nothing_unless_asked_and_skips_what_is_gone():
    everything = dict.fromkeys(["catalog", "synced_table", "cdf_config", "dev_branch", "delta_tables", "postgres_schemas"], True)
    assert lb.cleanup_actions("keep", everything) == []
    assert lb.cleanup_actions("", everything) == []
    assert lb.cleanup_actions("delete", {}) == []
    assert lb.cleanup_actions("DELETE", everything)[0] == "catalog"
    assert lb.cleanup_actions("delete", {"cdf_config": True, "catalog": False}) == ["cdf_config"]


# ---------- Change Data Feed ----------


def test_change_types_match_the_documented_values():
    assert lb.CHANGE_TYPES == ("insert", "update_preimage", "update_postimage", "delete")


def test_cdf_counts_and_missing_changes():
    before = lb.cdf_counts([("insert", 5)])
    assert before == {"insert": 5, "update_preimage": 0, "update_postimage": 0, "delete": 0}
    after = lb.cdf_counts([("insert", 5), ("update_preimage", 1), ("update_postimage", 1)])
    assert lb.cdf_missing_changes(before, after) == ["delete"]
    done = lb.cdf_counts([("insert", 5), ("update_preimage", 1), ("update_postimage", 1), ("delete", 1)])
    assert lb.cdf_missing_changes(before, done) == []


def test_is_stable_needs_equal_recent_readings():
    assert not lb.is_stable([1, 1])
    assert not lb.is_stable([1, 2, 2])
    assert lb.is_stable([1, 2, 2, 2])


def test_new_project_defaults():
    assert (lb.BRANCH, lb.ENDPOINT, lb.DATABASE) == ("production", "primary", "databricks_postgres")


def test_cdf_ready_state():
    assert lb.cdf_ready_state(["CDF_STATE_STREAMING"])
    assert not lb.cdf_ready_state(["CDF_STATE_STREAMING", "CDF_STATE_SNAPSHOTTING"])
    assert not lb.cdf_ready_state([])


# ---------- SQL is safe to run again ----------


def test_app_schema_ddl_is_idempotent():
    statements = lb.app_schema_sql("lakebase_apps")
    assert statements[0].startswith("CREATE SCHEMA IF NOT EXISTS")
    assert "CREATE TABLE IF NOT EXISTS lakebase_apps.orders" in statements[1]
    assert statements[2].endswith("REPLICA IDENTITY FULL")


def test_upserts_resolve_conflicts():
    assert "ON CONFLICT (order_id) DO UPDATE" in lb.upsert_orders_sql("lakebase_apps")
    assert "ON CONFLICT (id) DO UPDATE" in lb.upsert_docs_sql("lakebase_vectors")


def test_vector_setup_uses_if_not_exists_and_hnsw():
    statements = lb.vector_schema_sql("lakebase_vectors")
    assert statements[0] == "CREATE EXTENSION IF NOT EXISTS vector"
    assert all("IF NOT EXISTS" in s for s in statements)
    assert "USING hnsw (embedding vector_cosine_ops)" in statements[-1]
    with pytest.raises(ValueError):
        lb.vector_schema_sql("v", 0)


def test_vector_literal_and_nearest_sql():
    assert lb.vector_literal([0.5, 1, 0]) == "[0.5,1.0,0.0]"
    assert "ORDER BY embedding <=> %s::vector LIMIT 3" in lb.nearest_sql("lakebase_vectors")


def test_sql_builders_refuse_unsafe_identifiers():
    for build in (lb.app_schema_sql, lb.upsert_orders_sql, lb.vector_schema_sql, lb.nearest_sql):
        with pytest.raises(ValueError):
            build("x; DROP SCHEMA public")


def test_delta_source_is_created_if_missing_with_a_key_and_a_change_feed():
    create, alter = lb.delta_source_sql("main.s.lakebase_products")
    assert "CREATE TABLE IF NOT EXISTS main.s.lakebase_products" in create
    assert "PRIMARY KEY (product_id)" in create
    assert "delta.enableChangeDataFeed = true" in create and "delta.enableChangeDataFeed = true" in alter


def test_sample_data_shape():
    ids = [row[0] for row in lb.SAMPLE_ORDERS]
    assert len(set(ids)) == len(ids)
    assert lb.UPDATED_ORDER_ID in ids and lb.DELETED_ORDER_ID in ids and lb.UPDATED_ORDER_ID != lb.DELETED_ORDER_ID
    assert all(len(vec) == lb.VECTOR_DIMENSIONS for _, _, vec in lb.SAMPLE_DOCS)
    assert len({row[0] for row in lb.SAMPLE_PRODUCTS}) == len(lb.SAMPLE_PRODUCTS)


# ---------- the pool mints a token per connection ----------


def test_token_connection_asks_for_a_new_token_each_time(monkeypatch):
    psycopg = pytest.importorskip("psycopg")
    seen = []
    monkeypatch.setattr(psycopg.Connection, "connect", classmethod(lambda cls, conninfo="", **kw: seen.append(kw["password"]) or object()))
    tokens = iter(["t1", "t2"])
    cls = lb.make_token_connection_class(lambda: next(tokens))
    cls.connect("dbname=x")
    cls.connect("dbname=x")
    assert seen == ["t1", "t2"]


def test_connect_with_retry_waits_for_the_first_connection():
    slept, attempts = [], []

    class Conn:
        def execute(self, sql):
            attempts.append(sql)

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class Pool:
        def __init__(self):
            self.waits = 0

        def wait(self, timeout):
            self.waits += 1
            if self.waits < 3:
                raise RuntimeError("connection refused")

        def connection(self, timeout):
            return Conn()

    pool = Pool()
    assert lb.connect_with_retry(pool, sleep=slept.append) is pool
    assert attempts == ["SELECT 1"]
    assert slept == [0.5, 1.0]
