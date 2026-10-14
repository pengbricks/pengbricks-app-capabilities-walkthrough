from dx_demo.rules import band_for, is_valid_value, normalize_key


def test_normalize_trims_and_uppercases():
    assert normalize_key("  a-1 ") == "A-1"


def test_blank_and_null_keys_become_none():
    assert normalize_key("   ") is None
    assert normalize_key(None) is None


def test_value_rules():
    assert is_valid_value(0)
    assert not is_valid_value(-1)
    assert not is_valid_value(None)


def test_band_for():
    t = [(500, "large"), (100, "medium")]
    assert [band_for(v, t, "small") for v in (5, 100, 499, 500)] == ["small", "medium", "medium", "large"]
