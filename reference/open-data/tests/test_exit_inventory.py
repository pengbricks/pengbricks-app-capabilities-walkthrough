from open_data.exit_inventory import (
    NEEDS_CHANGES,
    REBUILD,
    RUNS_AS_IS,
    delta_features,
    iceberg_readability,
    inventory_row,
    props_from_rows,
)


def row(table_type="MANAGED", fmt="DELTA", props=None, detail=None, path=None):
    return inventory_row("c", "s", "t", table_type, fmt, path, props or {}, detail)


def test_props_from_rows_keeps_keys_and_values():
    assert props_from_rows([("a", 1), ("b", "x")]) == {"a": "1", "b": "x"}


def test_delta_features_reads_properties_and_detail():
    props = {"delta.enableDeletionVectors": "true", "delta.feature.typeWidening": "supported", "delta.columnMapping.mode": "name"}
    assert delta_features(props, ["variantType", "appendOnly"]) == ["columnMapping", "deletionVectors", "typeWidening", "variantType"]


def test_plain_delta_runs_as_is():
    result = row()
    assert result["verdict"] == RUNS_AS_IS
    assert result["managed_or_external"] == "managed"
    assert result["reader_features"] is None


def test_deletion_vectors_need_changes_without_uniform():
    result = row(props={"delta.enableDeletionVectors": "true"})
    assert result["verdict"] == NEEDS_CHANGES
    assert "deletion vectors" in result["reason"]


def test_uniform_table_is_readable_by_iceberg_clients():
    props = {"delta.universalFormat.enabledFormats": "iceberg", "delta.columnMapping.mode": "name"}
    assert iceberg_readability("MANAGED", "DELTA", props) == "UniForm (Iceberg reads)"
    assert row(props=props)["verdict"] == RUNS_AS_IS


def test_managed_iceberg_is_native():
    result = row(fmt="ICEBERG")
    assert result["iceberg_readability"] == "native Iceberg"
    assert result["verdict"] == RUNS_AS_IS


def test_external_parquet_runs_as_is_and_keeps_location():
    result = row("EXTERNAL", "PARQUET", path="s3://b/p")
    assert result["managed_or_external"] == "external"
    assert result["location"] == "s3://b/p"
    assert result["verdict"] == RUNS_AS_IS


def test_shallow_clone_needs_changes():
    result = row("MANAGED_SHALLOW_CLONE")
    assert result["verdict"] == NEEDS_CHANGES
    assert "shallow clone" in result["reason"]
    assert row("EXTERNAL_SHALLOW_CLONE")["managed_or_external"] == "external"


def test_catalog_commits_and_writer_only_features():
    props = {"delta.feature.catalogManaged": "supported", "delta.feature.rowTracking": "supported"}
    assert delta_features(props, ["rowTracking", "timestampNtz"]) == ["catalogManaged", "timestampNtz"]


def test_missing_properties_and_detail_do_not_fail():
    result = inventory_row("c", "s", "t", None, None, None, {}, None)
    assert result["table_name"] == "c.s.t"
    assert result["iceberg_readability"] == "none"


def test_derived_objects_are_not_data():
    assert row("VIEW", None)["verdict"] == NEEDS_CHANGES
    assert row("MATERIALIZED_VIEW", None)["verdict"] == REBUILD
    assert row("STREAMING_TABLE", None)["managed_or_external"] == "n/a"


def test_detail_supplies_location_and_size():
    result = row(detail={"location": "s3://b/t", "sizeInBytes": 2048})
    assert (result["location"], result["size_bytes"]) == ("s3://b/t", 2048)
