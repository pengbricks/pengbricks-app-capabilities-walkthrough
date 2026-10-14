import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from open_data.checks import check_row, scrub
from open_data.sharing import activation_token, credential_profile, file_urls, served_from_source, strip_query
from open_data.spec import column_comment_sql, column_options, load_spec

SPEC = Path(__file__).resolve().parents[1] / "use_cases" / "general.yml"


def test_credential_profile_has_open_sharing_fields():
    token = SimpleNamespace(share_credentials_version=1, bearer_token="abc", endpoint="https://x/api/2.0/delta-sharing/metastores/1", expiration_time="2027-01-01")
    profile = credential_profile(token)
    assert profile == {"shareCredentialsVersion": 1, "bearerToken": "abc", "endpoint": token.endpoint, "expirationTime": "2027-01-01"}


def test_activation_token_is_the_query_string():
    assert activation_token("https://host/delta_sharing/retrieve_config.html?AAAA123") == "AAAA123"


def test_file_urls_skips_metadata_lines():
    body = "\n".join([json.dumps({"protocol": {}}), json.dumps({"file": {"url": "https://b/p/t1/a.parquet?sig=1"}}), ""])
    assert file_urls(body) == ["https://b/p/t1/a.parquet?sig=1"]


def test_served_from_source_requires_every_file_under_table_path():
    location = "s3://bucket/__unitystorage/catalogs/c/tables/t1"
    inside = "https://bucket.s3.amazonaws.com/__unitystorage/catalogs/c/tables/t1/part-0.parquet?X=1"
    outside = "https://other.s3.amazonaws.com/copy/part-0.parquet"
    assert served_from_source(location, [inside])
    assert not served_from_source(location, [inside, outside])
    assert not served_from_source(location, [])


def test_strip_query_drops_signature():
    assert strip_query("https://b/p/a.parquet?X-Amz-Signature=secret") == "https://b/p/a.parquet"


def test_scrub_removes_secrets():
    assert scrub("token abc123 failed", ["abc123", ""]) == "token *** failed"


def test_check_row_rejects_unknown_status():
    assert check_row("g", "c", "PASS", "d", value="1")["status"] == "PASS"
    with pytest.raises(ValueError):
        check_row("g", "c", "MAYBE", "d")


def test_column_options_expression_and_random():
    assert column_options({"name": "a", "type": "string", "expr": "x"}) == {"expr": "x", "baseColumn": "id"}
    opts = column_options({"name": "b", "type": "int", "min": 1, "max": 5})
    assert opts == {"random": True, "minValue": 1, "maxValue": 5}


def test_column_comment_escapes_quotes():
    assert column_comment_sql("c.s.t", {"name": "x", "comment": "it's"}) == "COMMENT ON COLUMN c.s.t.x IS 'it''s'"


def test_spec_view_columns_exclude_personal_data_and_exist():
    spec = load_spec(str(SPEC))
    names = {c["name"] for c in spec["tables"]["orders"]["columns"]}
    assert set(spec["sharing"]["view_columns"]) <= names
    assert "customer_email" not in spec["sharing"]["view_columns"]
    assert all("comment" in c for t in spec["tables"].values() for c in t["columns"])


def test_blocked_is_a_valid_status():
    assert check_row("g", "c", "BLOCKED", "d")["status"] == "BLOCKED"


def test_missing_privilege_detection():
    import importlib

    module = importlib.import_module("share_and_read")
    assert module.is_missing_privilege("PERMISSION_DENIED: User does not have CREATE SHARE on Metastore 'm'")
    assert not module.is_missing_privilege("TABLE_OR_VIEW_NOT_FOUND")


def test_federation_helpers():
    from federation_check import is_missing_privilege, remote_query_sql, seed_sql

    assert remote_query_sql("c", "db", "SELECT 1") == "remote_query('c', database => 'db', query => 'SELECT 1')"
    assert is_missing_privilege("PERMISSION_DENIED: User does not have CREATE CATALOG on Metastore 'm'")
    statements = seed_sql("s", "t", 10)
    assert statements[1] == "DROP TABLE IF EXISTS s.t" and "generate_series(1, 10)" in statements[-1]
