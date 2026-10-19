from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from sample_data import cumulative_weights, generate, grid_steps, interval_seconds  # noqa: E402


def test_interval_and_grid():
    assert interval_seconds("15 minutes") == 900
    assert interval_seconds("1 day") == 86400
    assert grid_steps("2024-01-01", "2024-01-02", "1 hour") == 25
    with pytest.raises(ValueError):
        interval_seconds("fortnightly")


def test_weights_are_normalized_bounds():
    assert cumulative_weights([1, 1, 2]) == [0.25, 0.5, 1.0]
    with pytest.raises(ValueError):
        cumulative_weights([0, 0])


def test_bundle_copies_match_the_shared_source():
    source = (HERE / "sample_data.py").read_text()
    copies = sorted(HERE.parent.glob("*/src/sample_data.py"))
    stale = [str(path.relative_to(HERE.parent)) for path in copies if path.read_text() != source]
    assert not stale, f"Copy reference/_shared/sample_data.py over: {stale}"


@pytest.fixture(scope="module")
def spark():
    pyspark = pytest.importorskip("pyspark.sql")
    try:
        session = pyspark.SparkSession.builder.master("local[2]").appName("sample-data-test").getOrCreate()
    except Exception as error:  # no Java on this machine
        pytest.skip(f"local Spark unavailable: {error}")
    yield session
    session.stop()


COLUMNS = [
    {"name": "order_id", "type": "bigint", "expr": "id + 1000"},
    {"name": "status", "type": "string", "values": ["new", "paid", "void"], "weights": [6, 3, 1]},
    {"name": "region", "type": "string", "values": ["east", "west"]},
    {"name": "qty", "type": "int", "min": 1, "max": 5},
    {"name": "amount", "type": "decimal(10,2)", "min": 5, "max": 500},
    {"name": "ordered_at", "type": "timestamp", "begin": "2024-01-01 00:00:00", "end": "2024-01-31 23:00:00", "interval": "1 hour"},
    {"name": "order_date", "type": "date", "begin": "2024-01-01", "end": "2024-01-31", "interval": "1 day"},
    {"name": "big", "type": "boolean", "expr": "qty > 3"},
]


def test_generate_is_deterministic_and_in_range(spark):
    first = generate(spark, COLUMNS, rows=2000, seed=7, name="orders", partitions=4)
    second = generate(spark, COLUMNS, rows=2000, seed=7, name="orders", partitions=1)
    assert first.columns == [column["name"] for column in COLUMNS]
    assert sorted(first.collect()) == sorted(second.collect())
    stats = first.selectExpr(
        "min(order_id)", "max(order_id)", "min(qty)", "max(qty)", "min(amount)", "max(amount)",
        "min(ordered_at)", "max(ordered_at)", "count(distinct region)", "sum(cast(status = 'new' as int))",
        "sum(cast(big <> (qty > 3) as int))",
    ).first()
    assert (stats[0], stats[1]) == (1000, 2999)
    assert stats[2] >= 1 and stats[3] <= 5
    assert float(stats[4]) >= 5 and float(stats[5]) <= 500
    assert str(stats[6]) >= "2024-01-01" and str(stats[7]) <= "2024-01-31 23:00:00"
    assert stats[8] == 2
    assert 1000 < stats[9] < 1400  # about 60% new
    assert stats[10] == 0


def test_another_seed_changes_values(spark):
    a = generate(spark, COLUMNS[:2], rows=200, seed=1, name="orders").collect()
    b = generate(spark, COLUMNS[:2], rows=200, seed=2, name="orders").collect()
    assert a != b
