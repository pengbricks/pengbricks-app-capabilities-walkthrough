import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import aidq_lib as q  # noqa: E402


def test_model_parameters_pin_temperature_to_zero():
    assert q.MODEL_PARAMETERS_SQL == "named_struct('temperature', 0.0)"
    notebook = (ROOT / "guides" / "ai-functions-data-quality" / "03_ai_checks.py").read_text()
    assert "modelParameters => {q.MODEL_PARAMETERS_SQL}" in notebook


@pytest.fixture
def spec():
    return q.load_spec(str(ROOT / "use_cases" / "data_quality.yml"))


@pytest.fixture
def sample(spec):
    return q.generate_sample(spec["sample"]["rows"], spec["sample"]["seed"])


def test_sample_is_deterministic_and_sized(spec, sample):
    records, truth = sample
    assert len(records) == len(truth) == spec["sample"]["rows"]
    assert q.generate_sample(300, 42) == sample
    assert [r["record_id"] for r in records] == list(range(1, 301))
    assert not set(records[0]) & set(truth[0]) - {"record_id"}


def test_every_problem_is_present_and_has_clean_rows(sample):
    _, truth = sample
    for column in ("truth_reason_bad", "truth_address_bad", "truth_duplicate", "truth_pii", "truth_contradiction"):
        bad = sum(t[column] for t in truth)
        assert 15 <= bad <= len(truth) - 15, column


def test_exact_duplicates_share_a_key_with_an_earlier_record(sample):
    records, truth = sample
    first = {}
    for r, t in zip(records, truth):
        first.setdefault(t["truth_entity"], q.normalize_name(r["company_raw"]))
    exact = [r for r, t in zip(records, truth) if t["truth_duplicate"] and q.normalize_name(r["company_raw"]) == first[t["truth_entity"]]]
    fuzzy = [r for r, t in zip(records, truth) if t["truth_duplicate"] and q.normalize_name(r["company_raw"]) != first[t["truth_entity"]]]
    assert exact and fuzzy
    assert all(not t["truth_duplicate"] for t in truth[:50])


def test_a_duplicate_never_comes_before_its_first_record(sample):
    seen = set()
    for t in sample[1]:
        assert t["truth_duplicate"] == (t["truth_entity"] in seen)
        seen.add(t["truth_entity"])


def test_normalize_and_block_key():
    assert q.normalize_name("Northwind Traders Inc.") == q.normalize_name("NORTHWIND TRADERS, Inc.") == "northwindtraders"
    assert q.block_key("Acme Co", 3) == "acm"


def test_rules_leave_a_residue_but_not_everything(spec, sample):
    verdicts = [q.rule_verdict_reason(spec, r) for r in sample[0]]
    share = q.residue_share(verdicts.count("unknown"), len(verdicts))
    assert 0.2 < share < 0.8
    assert "fail" in verdicts and "pass" in verdicts


def test_rule_verdicts_agree_with_the_truth(spec, sample):
    for r, t in zip(*sample):
        verdict = q.rule_verdict_reason(spec, r)
        if verdict != "unknown":
            assert (verdict == "fail") == t["truth_reason_bad"], r["reason_text"]


def test_canonical_addresses_are_truly_fine_and_pii_patterns_are_truly_pii(spec, sample):
    canon = re.compile(spec["address"]["canonical_pattern"])
    pii = [re.compile(p) for p in spec["pii"]["patterns"].values()]
    for r, t in zip(*sample):
        if canon.match(r["address_raw"]):
            assert not t["truth_address_bad"] and r["address_raw"].endswith(t["truth_postal_code"])
        if any(p.search(r["note"]) for p in pii):
            assert t["truth_pii"]


def test_rule_sql_has_one_query_per_check_and_embeds_patterns(spec):
    queries = q.rule_queries(spec, "`c`.`s`.`aidq_records`")
    assert tuple(queries) == q.CHECKS
    assert all("`c`.`s`.`aidq_records`" in sql for sql in queries.values())
    assert "'unknown'" in queries["reason_code"] and "RLIKE" in queries["sensitive_note"]
    assert "damaged|broken|cracked|crushed" in queries["reason_code"]


def test_spec_rejects_bad_input(spec):
    spec["tables"]["records"] = "records"
    with pytest.raises(ValueError, match="aidq_"):
        q.validate_spec(spec)
    spec = q.load_spec(str(ROOT / "use_cases" / "data_quality.yml"))
    spec["reason"]["keywords"]["damaged"] = "it's"
    with pytest.raises(ValueError, match="quotes"):
        q.validate_spec(spec)
    spec = q.load_spec(str(ROOT / "use_cases" / "data_quality.yml"))
    spec["duplicates"]["pass_below"] = 0.9
    with pytest.raises(ValueError, match="pass_below"):
        q.validate_spec(spec)
    spec = q.load_spec(str(ROOT / "use_cases" / "data_quality.yml"))
    spec["sample"]["rows"] = 50000
    with pytest.raises(ValueError, match="bound"):
        q.validate_spec(spec)


def test_response_format_is_the_documented_json_schema_shape():
    fmt = json.loads(q.response_format_json())
    assert fmt["type"] == "json_schema" and fmt["json_schema"]["strict"] is True
    assert fmt["json_schema"]["schema"]["properties"]["verdict"]["enum"] == ["pass", "fail"]
    assert "'" not in q.response_format_json()


def test_parse_verdict():
    assert q.parse_verdict('{"verdict": "FAIL", "reason": "arrived despite status"}') == ("fail", "arrived despite status")
    assert q.parse_verdict("not json")[0] == "review"
    assert q.parse_verdict(None)[0] == "review"
    assert q.parse_verdict('{"verdict": "maybe", "reason": ""}')[0] == "review"
    assert q.parse_verdict('{"reason": "x"}')[0] == "review"


def test_parse_classify_and_verdict():
    raw = '{"response":[{"value":"late","confidence_score":0.93}],"error_message":null}'
    assert q.parse_classify(raw) == ("late", 0.93, None)
    assert q.parse_classify('{"response":null,"error_message":"boom"}') == (None, None, "boom")
    assert q.classify_verdict("late", 0.93, "late", 0.7) == ("pass", "model agrees with the submitted code")
    assert q.classify_verdict("late", 0.93, "damaged", 0.7)[0] == "fail"
    assert q.classify_verdict("late", 0.5, "late", 0.7)[0] == "review"
    assert q.classify_verdict(None, None, "late", 0.7)[0] == "review"


def test_parse_extract_and_verdict():
    raw = '{"response":{"postal_code":{"value":"62704","confidence_score":0.9},"state":{"value":null}},"error_message":null}'
    values, error = q.parse_extract(raw, ["postal_code", "state"])
    assert values == {"postal_code": "62704", "state": None} and error is None
    assert q.extract_verdict(values, error)[0] == "pass"
    assert q.extract_verdict({"postal_code": "627"}, None)[0] == "fail"
    assert q.extract_verdict({}, "bad")[0] == "review"
    assert json.loads(q.extract_schema_json())["postal_code"]["type"] == "string"


def test_mask_and_similarity_verdicts():
    assert q.mask_verdict("Ask for Maria", "Ask for [MASKED]") == ("fail", "ai_mask masked 1 span(s)")
    assert q.mask_verdict("Fragile", "Fragile")[0] == "pass"
    assert q.mask_verdict("x", None)[0] == "review"
    assert [q.similarity_verdict(s, 0.85, 0.6) for s in (0.9, 0.85, 0.7, 0.3, None)] == ["fail", "fail", "review", "pass", "review"]
    assert q.valid_postal_code(" 62704 ") and not q.valid_postal_code("6270") and not q.valid_postal_code(None)


def test_confusion_counts_review_apart_and_gate(spec):
    pairs = [(True, "fail"), (True, "fail"), (True, "pass"), (False, "fail"), (False, "pass"), (True, "review"), (False, "review")]
    m = q.confusion(pairs)
    assert (m["tp"], m["fp"], m["fn"], m["tn"], m["review"]) == (2, 1, 1, 1, 2)
    assert m["precision"] == pytest.approx(2 / 3) and m["recall"] == pytest.approx(2 / 3)
    assert m["missed_in_review"] == pytest.approx(0.25)
    assert q.gate(m, spec["thresholds"]) == "precision below threshold"
    assert q.gate(q.confusion([(True, "fail"), (False, "pass")]), spec["thresholds"]) == "ok"
    assert q.gate(q.confusion([(True, "fail")] * 3 + [(False, "review")] * 3), spec["thresholds"]) == "too many rows in human review"
    assert q.confusion([])["precision"] == 1.0


def test_cost_helpers():
    assert q.estimate_tokens(400) == 100 and q.estimate_tokens(10, 4) == 2
    assert q.per_thousand(2.0, 500) == 4.0 and q.per_thousand(None, 500) is None and q.per_thousand(1.0, 0) is None
    assert q.residue_share(0, 0) == 0.0


def test_prompt_matches_the_sql_concat():
    assert q.validation_prompt("delivered", "never came").startswith(q.VALIDATION_INSTRUCTIONS + " Status: delivered. Comment: never")


def test_table_sql_covers_rule_and_ai_rows_and_quarantine():
    sql = q.combine_sql("rules", "ai")
    assert "verdict <> 'unknown'" in sql and "'ai' AS source" in sql
    assert "GROUP BY record_id" in q.quarantine_sql("quality")


def test_split_query_struct_accepts_response_or_result():
    import aidq_lib as q

    assert q.split_query_struct('{"response":"{\\"verdict\\":\\"pass\\"}","errorMessage":null}') == ('{"verdict":"pass"}', None)
    assert q.split_query_struct('{"result":"x","errorMessage":"boom"}') == ("x", "boom")
    assert q.split_query_struct(None)[1] == "empty struct"
