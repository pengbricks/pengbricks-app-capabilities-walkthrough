from __future__ import annotations

import sys
from pathlib import Path

import pytest

BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT / "src"))

from capability_framework.adapters import get_adapter  # noqa: E402
from capability_framework.adapters.provider_a import status_case_sql  # noqa: E402
from capability_framework.config import load_feed, parse_feed  # noqa: E402
from capability_framework.datagen import bad_row_exprs, column_options  # noqa: E402
from capability_framework.use_case import load_use_case, render_feeds  # noqa: E402
from capability_framework.validation import quarantine_reasons_sql, rule_to_sql  # noqa: E402

SPEC_PATH = BUNDLE_ROOT / "use_cases" / "general.yml"


def test_committed_feeds_match_the_spec() -> None:
    spec = load_use_case(SPEC_PATH)
    for name, text in render_feeds(spec).items():
        assert (BUNDLE_ROOT / "feeds" / spec["name"] / name).read_text(encoding="utf-8") == text


def test_rendering_is_deterministic() -> None:
    spec = load_use_case(SPEC_PATH)
    assert render_feeds(spec) == render_feeds(spec)


def test_second_feed_needs_no_code() -> None:
    feed = load_feed(BUNDLE_ROOT / "feeds" / "general", "provider_b")
    assert feed.adapter == "generic"
    assert get_adapter(feed.adapter).__module__.endswith("adapters.generic")


def test_feeds_share_the_same_rules() -> None:
    a = load_feed(BUNDLE_ROOT / "feeds" / "general", "provider_a")
    b = load_feed(BUNDLE_ROOT / "feeds" / "general", "provider_b")
    assert [rule.name for rule in a.rules] == [rule.name for rule in b.rules]


def test_unmapped_canonical_column_is_rejected() -> None:
    with pytest.raises(ValueError, match="status"):
        parse_feed(
            {
                "name": "broken",
                "source": {"format": "csv"},
                "mapping": {"record_id": "a", "account_id": "b", "event_ts": "c", "amount": "d", "currency": "e"},
                "keys": ["record_id"],
            }
        )


def test_rules_compile_to_sql() -> None:
    feed = load_feed(BUNDLE_ROOT / "feeds" / "general", "provider_a")
    compiled = [rule_to_sql(rule) for rule in feed.rules]
    assert "`record_id` IS NOT NULL" in compiled
    assert "`currency` IN ('USD', 'EUR', 'GBP')" in compiled
    assert quarantine_reasons_sql(feed.rules).startswith("filter(array(")


def test_unknown_adapter_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unknown adapter"):
        get_adapter("provider_z")


def test_provider_a_status_codes_are_isolated_in_its_adapter() -> None:
    assert "WHEN 'A' THEN 'approved'" in status_case_sql("STATUS_CD")


def test_datagen_options_follow_the_spec() -> None:
    spec = load_use_case(SPEC_PATH)
    columns = {column["name"]: column for column in spec["entity"]["columns"]}
    assert column_options(columns["record_id"]) == {"expr": columns["record_id"]["expr"], "baseColumn": "id"}
    assert column_options(columns["currency"])["weights"] == [8, 1, 1]
    assert all("id %" in expression for _, expression in bad_row_exprs(spec))
