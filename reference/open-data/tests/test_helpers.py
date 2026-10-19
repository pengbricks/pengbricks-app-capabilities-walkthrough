import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from open_data.checks import check_row, scrub
from open_data.sharing import activation_exchange_url, activation_token, credential_profile, file_urls, served_from_source, strip_query
from open_data.spec import column_comment_sql, load_spec

SPEC = Path(__file__).resolve().parents[1] / "use_cases" / "general.yml"


def test_credential_profile_has_open_sharing_fields():
    token = SimpleNamespace(share_credentials_version=1, bearer_token="abc", endpoint="https://x/api/2.0/delta-sharing/metastores/1", expiration_time="2027-01-01")
    profile = credential_profile(token)
    assert profile == {"shareCredentialsVersion": 1, "bearerToken": "abc", "endpoint": token.endpoint, "expirationTime": "2027-01-01"}


def test_activation_token_is_the_query_string():
    assert activation_token("https://host/delta_sharing/retrieve_config.html?AAAA123") == "AAAA123"


def test_activation_exchange_url_uses_the_link_host():
    url = "https://abc.opensharing.eastus2.example.net/opensharing/retrieve_config.html?bm9uY2U/MTIz+x=="
    assert activation_exchange_url(url) == (
        "https://abc.opensharing.eastus2.example.net/api/2.1/unity-catalog/public/data_sharing_activation/bm9uY2U%2FMTIz%2Bx%3D%3D"
    )


def test_file_urls_skips_metadata_lines():
    body = "\n".join([json.dumps({"protocol": {}}), json.dumps({"file": {"url": "https://b/p/t1/a.parquet?sig=1"}}), ""])
    assert file_urls(body) == ["https://b/p/t1/a.parquet?sig=1"]


def test_file_urls_reads_delta_format_responses():
    body = json.dumps({"file": {"id": "1", "deltaSingleAction": {"add": {"path": "https://b/p/t1/b.parquet?sig=2"}}}})
    assert file_urls(body) == ["https://b/p/t1/b.parquet?sig=2"]


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


def test_spec_columns_use_options_the_generator_supports():
    from sample_data import grid_steps, interval_seconds

    spec = load_spec(str(SPEC))
    tables = list(spec["tables"].values()) + [spec["file_formats"]]
    for table in tables:
        for column in table["columns"]:
            assert "type" in column and "name" in column
            if "begin" in column:
                assert grid_steps(column["begin"], column["end"], column.get("interval", "1 day")) >= 1
                assert interval_seconds(column.get("interval", "1 day")) > 0
            if "weights" in column:
                assert len(column["weights"]) == len(column["values"])


def test_column_comment_escapes_quotes():
    assert column_comment_sql("c.s.t", {"name": "x", "comment": "it's"}) == "COMMENT ON COLUMN c.s.t.x IS 'it''s'"


def test_spec_view_columns_exclude_personal_data_and_exist():
    spec = load_spec(str(SPEC))
    names = {c["name"] for c in spec["tables"]["sharing_orders"]["columns"]}
    assert set(spec["sharing"]["view_columns"]) <= names
    assert "customer_email" not in spec["sharing"]["view_columns"]
    assert all("comment" in c for t in spec["tables"].values() for c in t["columns"])


def test_blocked_is_a_valid_status():
    assert check_row("g", "c", "BLOCKED", "d")["status"] == "BLOCKED"


def test_missing_privilege_detection():
    from open_data.sharing import is_missing_privilege

    module = type("m", (), {"is_missing_privilege": staticmethod(is_missing_privilege)})
    assert module.is_missing_privilege("PERMISSION_DENIED: User does not have CREATE SHARE on Metastore 'm'")
    assert not module.is_missing_privilege("TABLE_OR_VIEW_NOT_FOUND")


def test_federation_helpers():
    from open_data.federation import is_missing_privilege, remote_query_sql, seed_sql

    assert remote_query_sql("c", "db", "SELECT 1") == "remote_query('c', database => 'db', query => 'SELECT 1')"
    assert is_missing_privilege("PERMISSION_DENIED: User does not have CREATE CATALOG on Metastore 'm'")
    statements = seed_sql("s", "t", 10)
    assert statements[1] == "DROP TABLE IF EXISTS s.t" and "generate_series(1, 10)" in statements[-1]


def test_audit_event_query_starts_a_minute_early():
    from open_data.sharing import audit_event_query

    query = audit_event_query(1000, "my_share", "my_recipient")
    assert "timestamp_seconds(940)" in query and "%my_share%" in query and "%my_recipient%" in query


def test_iceberg_and_connector_helpers():
    from open_data.connector import http_path
    from open_data.iceberg import catalog_properties

    props = catalog_properties("https://h/", "cat", "/api/2.1/unity-catalog/iceberg-rest", "tok")
    assert props["uri"] == "https://h/api/2.1/unity-catalog/iceberg-rest" and props["header.X-Iceberg-Access-Delegation"] == "vended-credentials"
    assert http_path("abc") == "/sql/1.0/warehouses/abc"


from open_data.formats import (
    delta_log_summary,
    first_error_line,
    human_bytes,
    median_seconds,
    plan_evidence,
    summarize_files,
    type_drift,
)


def test_summarize_files_skips_commit_markers():
    entries = [("/v/p/part-0.parquet", 100), ("/v/p/part-1.parquet", 50), ("/v/p/_SUCCESS", 0), ("/v/p/_committed_123", 9), ("/v/p/.part-0.parquet.crc", 3)]
    assert summarize_files(entries) == {"files": 2, "bytes": 150}


def test_human_bytes_scales_units():
    assert human_bytes(512) == "512 B"
    assert human_bytes(2048) == "2.0 KB"
    assert human_bytes(5 * 1024**2) == "5.0 MB"


def test_type_drift_flags_changed_and_missing_columns():
    written = {"amount": "decimal(12,2)", "order_date": "date", "quantity": "int", "gone": "string"}
    inferred = {"amount": "double", "order_date": "string", "quantity": "INT"}
    drift = {row["column"]: row["drift"] for row in type_drift(written, inferred)}
    assert drift == {"amount": True, "order_date": True, "quantity": False, "gone": True}


def test_median_seconds_rounds():
    assert median_seconds([3.0, 1.0, 2.12345]) == 2.123


def test_first_error_line_skips_stack_frames():
    message = "\n\nJVM stacktrace:\n[UNSUPPORTED_FEATURE.TABLE_OPERATION] UPDATE is not supported\nat x.y"
    assert first_error_line(message) == "[UNSUPPORTED_FEATURE.TABLE_OPERATION] UPDATE is not supported"


def test_plan_evidence_reads_columns_and_filters():
    plan = "Batched: true\nPushedFilters: [IsNotNull(order_date), EqualTo(order_date,2025-03-04)]\nReadSchema: struct<order_date:date,amount:decimal(12,2)>"
    found = plan_evidence(plan)
    assert found["columns_read"] == ["order_date", "amount"]
    assert "EqualTo(order_date" in found["pushed_filters"]


def test_plan_evidence_handles_nested_commas():
    found = plan_evidence("ReadSchema: struct<a:int,shipping:struct<city:string,postal:string>,b:int>")
    assert found["columns_read"] == ["a", "shipping", "b"]


def test_delta_log_summary_counts_commits_and_checkpoints():
    names = ["00000000000000000000.json", "00000000000000000001.json", "00000000000000000010.checkpoint.parquet", "_last_checkpoint", "00000000000000000010.json"]
    summary = delta_log_summary(names)
    assert summary == {"commits": 3, "checkpoints": 1, "has_last_checkpoint": True, "latest_commit": "00000000000000000010.json"}


def test_file_formats_spec_covers_the_types_the_guide_compares():
    section = load_spec(str(SPEC))["file_formats"]
    by_name = {c["name"]: c["type"] for c in section["columns"]}
    assert section["rows"] == 1000000
    assert {"date", "timestamp", "decimal(12,2)", "decimal(5,2)", "int", "string"} <= set(by_name.values())
    assert {"order_date", "order_ts", "amount", "discount", "status"} <= set(by_name)
    assert all("comment" in c for c in section["columns"])


def test_nested_columns_are_named_for_the_guide():
    from open_data.formats import NESTED_COLUMNS

    assert [name for name, _ in NESTED_COLUMNS] == ["shipping", "items"]


def test_pair_scans_matches_by_rows_and_order():
    from open_data.formats import pair_scans

    formats = ["json", "csv", "parquet"]
    scans = [{"read_rows": 10, "read_bytes": 1}, {"read_rows": 10, "read_bytes": 2}, {"read_rows": 10, "read_bytes": 3}, {"read_rows": 99, "read_bytes": 0}]
    paired = pair_scans(scans, {"d1": 10}, formats)
    assert [paired[(f, "d1")]["read_bytes"] for f in formats] == [1, 2, 3]


def test_pair_scans_skips_json_when_it_reports_nothing():
    from open_data.formats import pair_scans

    scans = [{"read_rows": 7, "read_bytes": 2}, {"read_rows": 7, "read_bytes": 3}]
    paired = pair_scans(scans, {"d1": 7}, ["json", "csv", "parquet"])
    assert ("json", "d1") not in paired
    assert paired[("csv", "d1")]["read_bytes"] == 2 and paired[("parquet", "d1")]["read_bytes"] == 3


def test_pair_scans_gives_up_on_an_ambiguous_day():
    from open_data.formats import pair_scans

    assert pair_scans([{"read_rows": 7}], {"d1": 7}, ["json", "csv", "parquet"]) == {}
