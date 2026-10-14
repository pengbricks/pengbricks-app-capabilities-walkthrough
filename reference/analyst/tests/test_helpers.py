import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pytest

from analyst_common.datagen import column_options
from analyst_common.helpers import (
    match_counts,
    match_status,
    read_delimited,
    totals_match,
    upload_path,
    user_folder,
    write_delimited,
)


def test_user_folder_collapses_punctuation():
    assert user_folder("Ada.Lovelace@Example.com") == "ada_lovelace_example_com"


def test_user_folder_rejects_empty():
    with pytest.raises(ValueError):
        user_folder("@@")


def test_upload_path_is_per_user():
    a = upload_path("c", "s", "uploads", "a@x.com", "f.csv")
    b = upload_path("c", "s", "uploads", "b@x.com", "f.csv")
    assert a == "/Volumes/c/s/uploads/a_x_com/f.csv"
    assert a != b


def test_match_status_and_counts():
    statuses = [match_status(True, True), match_status(True, False), match_status(False, True), match_status(True, True)]
    assert match_counts(statuses) == {"matched": 2, "upload_only": 1, "governed_only": 1}
    with pytest.raises(ValueError):
        match_status(False, False)


def test_delimited_round_trip_quotes_pipes(tmp_path):
    path = str(tmp_path / "out.txt")
    count = write_delimited(path, ["id", "note"], [[1, "a|b"], [2, None]])
    assert count == 2
    assert "\"a|b\"" in Path(path).read_text()
    assert read_delimited(path) == [{"id": "1", "note": "a|b"}, {"id": "2", "note": ""}]


def test_totals_match_tolerance():
    assert totals_match("100.00", 100.004)
    assert not totals_match("100.00", "100.02")


def test_column_options_expr_and_random():
    assert column_options({"expr": "id"}) == {"expr": "id", "baseColumn": "id"}
    options = column_options({"values": ["a"], "weights": [1], "min": 1, "max": 2})
    assert options["random"] and options["minValue"] == 1 and options["weights"] == [1]
