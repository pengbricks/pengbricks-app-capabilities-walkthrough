"""Helpers for the AI Functions for data quality guide: a deterministic messy sample, rule SQL, and scoring.

Everything here runs without Spark, so the pure parts are unit-tested. The notebooks call these and keep
the AI Function SQL (ai_classify, ai_extract, ai_similarity, ai_mask, ai_query) in plain view.
"""

from __future__ import annotations

import json
import random
import re
from typing import Any

import yaml

import aif_lib as a

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_ENDPOINT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
CHECKS = ("reason_code", "address", "duplicate_company", "sensitive_note", "status_comment")
VERDICTS = ("pass", "fail", "unknown", "review")


# --- spec ---------------------------------------------------------------------------------------
def load_spec(path: str) -> dict[str, Any]:
    with open(path) as handle:
        spec = yaml.safe_load(handle)
    validate_spec(spec)
    return spec


def validate_spec(spec: dict[str, Any]) -> None:
    for name in spec["tables"].values():
        if not _IDENT.match(name) or not name.startswith("aidq_"):
            raise ValueError(f"Table names are identifiers that start with aidq_: {name}")
    if not _ENDPOINT.match(spec["endpoint"]):
        raise ValueError(f"Not an endpoint name: {spec['endpoint']}")
    labels = spec["reason"]["labels"]
    if not 2 <= len(labels) <= 500 or set(spec["reason"]["keywords"]) != set(labels):
        raise ValueError("Reason keywords need one entry per label, and 2 to 500 labels")
    for pattern in [spec["reason"]["keywords"][k] for k in labels] + list(spec["pii"]["patterns"].values()) + [
        spec["address"]["canonical_pattern"]
    ]:
        re.compile(pattern)
        if "'" in pattern or "\\" in pattern:
            raise ValueError(f"Patterns avoid quotes and backslashes so they embed in SQL as written: {pattern}")
    dup = spec["duplicates"]
    if not 0 <= dup["pass_below"] < dup["fail_at"] <= 1:
        raise ValueError("duplicates: need 0 <= pass_below < fail_at <= 1")
    if not 0 <= float(spec["reason"]["min_confidence"]) <= 1:
        raise ValueError("reason.min_confidence must be between 0 and 1")
    if not 100 <= int(spec["sample"]["rows"]) <= 1000:
        raise ValueError("Keep the sample between 100 and 1,000 rows to bound AI Function cost")


# --- the messy sample ---------------------------------------------------------------------------
_PREFIXES = ["Northwind", "Contoso", "Fabrikam", "Litware", "Adatum", "Tailspin", "Wingtip", "Proseware", "Lucerne", "Margie",
             "Alpine", "Blue Yonder", "Coho", "Fourth Coffee", "Graphic Design", "Humongous", "Lakeshore", "Munson", "Relecloud",
             "Trey", "Vanarsdel", "Woodgrove", "Bellows", "Cascade", "Driftwood", "Evergreen", "Foxglove", "Granite", "Harbor",
             "Ironwood", "Juniper", "Kestrel", "Larkspur", "Meridian", "Nimbus", "Orchard", "Pinnacle", "Quarry", "Redwood", "Summit"]
_NOUNS = ["Traders", "Foods", "Logistics", "Supply", "Industries", "Partners", "Systems", "Goods", "Works", "Labs", "Group", "Outfitters"]
_SUFFIX = ["Inc.", "LLC", "Ltd", "Corp"]
_STREETS = ["Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine Rd", "Elm St", "Lake View Blvd", "Hill St"]
_CITIES = [("Springfield", "IL", "Illinois", "62704"), ("Riverton", "WY", "Wyoming", "82501"), ("Fairview", "OR", "Oregon", "97024"),
           ("Madison", "WI", "Wisconsin", "53703"), ("Georgetown", "TX", "Texas", "78626"), ("Clinton", "IA", "Iowa", "52732")]
_REASONS = {
    "damaged": ["The box arrived crushed and the lamp was broken", "Screen cracked when I opened it", "Item came damaged",
                "It did not survive the trip", "Arrived in pieces", "The handle snapped off on day one"],
    "wrong_item": ["Got the wrong item, I ordered the red one", "Wrong size, this is a medium", "This is not what I ordered",
                   "You sent a different model than the one on my order"],
    "late": ["It was late by two weeks", "Delivery delayed again and again", "Showed up well past the promised date",
             "I waited a month for this"],
    "changed_mind": ["I changed my mind", "No longer need it", "Do not want it anymore", "Bought it by mistake, returning"],
}
_COMMENTS_OK = {
    "delivered": ["Arrived on time and works well", "Delivered to the front desk, thanks", "Everything was in the box"],
    "shipped": ["Tracking shows it is on the way", "Expecting it Thursday"],
    "cancelled": ["Cancelled it, found a cheaper one", "Please cancel, ordered twice"],
    "returned": ["Sent it back for a refund", "Returned unopened"],
}
_COMMENTS_BAD = {
    "delivered": ["Still waiting, nothing has arrived", "Never received this order"],
    "shipped": ["I already have it in my hands and it works", "It arrived last week"],
    "cancelled": ["Using it every day, love it", "It arrived and works great"],
    "returned": ["Still have it and not sending it back", "Never returned, it is on my desk"],
}
_NOTES_CLEAN = ["Leave at the back door", "Call before delivery", "Gift wrap please", "Ring the bell twice", "Fragile", "Leave with the neighbor"]
_NOTES_REGEX = ["Call me at 555-010-0142 if it is not here", "Email jo.lee@example.com with the tracking", "My number is (555) 010-0177",
                "Billing contact is ana.cruz@example.org"]
_NOTES_HIDDEN = ["Please ship it to my sister Dana Whitfield at her office", "Ask for Maria at the front desk", "Send to Dr. Okafor, third floor",
                 "Deliver to my father Samuel Reyes next door", "I live at the end of Cedar Ln, the blue house"]


def normalize_name(name: str) -> str:
    """The exact-match key for company names: lower case, legal suffixes dropped, punctuation and spaces removed."""
    text = re.sub(r"(^| )(inc|llc|ltd|corp|co|company)[.,]?( |$)", " ", name.lower())
    return re.sub(r"[^a-z0-9]", "", text)


def block_key(name: str, chars: int = 3) -> str:
    return normalize_name(name)[:chars]


def _fuzzy(name: str, rng: random.Random) -> str:
    """A near-duplicate that exact matching misses: a typo after the block key, an abbreviation, or an added word."""
    choice = rng.choice(["typo", "abbr", "word"])
    base = re.sub(r"[.,]?\s*(Inc\.|LLC|Ltd|Corp)$", "", name)
    if choice == "typo" and len(base) > 7:
        i = rng.randrange(5, len(base) - 1)
        return base[:i] + base[i + 1] + base[i] + base[i + 2:]
    if choice == "abbr":
        return base.replace("Industries", "Ind.").replace("Logistics", "Logistic").replace("Supply", "Supply Co").replace("Systems", "Sys")
    return base + " Holdings"


def _address(rng: random.Random, kind: str) -> tuple[str, str | None, str | None]:
    city, abbr, full, zip_code = rng.choice(_CITIES)
    number, street = rng.randint(2, 980), rng.choice(_STREETS)
    if kind == "canonical":
        return f"{number} {street}, {city}, {abbr} {zip_code}", zip_code, abbr
    if kind == "messy":
        style = rng.choice(["lower", "nocomma", "swapped"])
        if style == "lower":
            return f"{number} {street.lower()} apt {rng.randint(1, 9)} {city.lower()} {full.lower()} {zip_code}", zip_code, abbr
        if style == "nocomma":
            return f"{number} {street} {city} {abbr} {zip_code}", zip_code, abbr
        return f"{street} {number}, {city} {zip_code}", zip_code, abbr
    return rng.choice([f"near the old mill, {city}", "TBD", f"{city}, ask the neighbors", f"{number} {street}, {city}"]), None, None


def generate_sample(rows: int = 300, seed: int = 42) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (records, truth). Records hold only inputs; truth holds the answers a reviewer would give."""
    rng = random.Random(seed)
    names = [f"{p} {n}" for p in _PREFIXES for n in _NOUNS]
    rng.shuffle(names)
    duplicates = rows // 4
    entities = names[: rows - duplicates]
    kinds = ["new"] * len(entities) + ["exact"] * (duplicates * 2 // 5) + ["fuzzy"] * (duplicates - duplicates * 2 // 5)
    order = list(range(len(entities)))
    # New entities come first in a shuffled order; duplicates are placed after some earlier record of their entity.
    seq: list[tuple[str, int]] = [("new", i) for i in order]
    for kind in kinds[len(entities):]:
        seq.insert(rng.randrange(len(entities) // 3, len(seq) + 1), (kind, -1))
    records, truth = [], []
    first_seen: dict[int, int] = {}
    last_new: list[int] = []
    for position, (kind, ent) in enumerate(seq, start=1):
        if kind == "new":
            entity = ent
            first_seen[entity] = position
            last_new.append(entity)
            company = f"{entities[entity]} {rng.choice(_SUFFIX)}" if rng.random() < 0.6 else entities[entity]
            is_dup = False
        else:
            entity = rng.choice(last_new)
            base = entities[entity]
            company = f"{base.upper()}, {rng.choice(_SUFFIX)}" if kind == "exact" else _fuzzy(base, rng)
            is_dup = True
        code = rng.choice(list(_REASONS))
        text = rng.choice(_REASONS[code])
        submitted = code if rng.random() > 0.15 else rng.choice([c for c in _REASONS if c != code])
        roll = rng.random()
        addr, zip_code, state = _address(rng, "canonical" if roll < 0.55 else "messy" if roll < 0.9 else "invalid")
        status = rng.choice(list(_COMMENTS_OK))
        roll = rng.random()
        comment, contradiction = ("", False) if roll < 0.45 else (
            (rng.choice(_COMMENTS_BAD[status]), True) if roll < 0.55 + 0.45 * 0.2 else (rng.choice(_COMMENTS_OK[status]), False))
        roll = rng.random()
        note, pii = ("", False) if roll < 0.3 else (
            (rng.choice(_NOTES_CLEAN), False) if roll < 0.8 else (rng.choice(_NOTES_REGEX), True) if roll < 0.9 else (rng.choice(_NOTES_HIDDEN), True))
        records.append({"record_id": position, "company_raw": company, "order_status": status, "reason_code": submitted,
                        "reason_text": text, "address_raw": addr, "comment": comment, "note": note})
        truth.append({"record_id": position, "truth_entity": entity, "truth_duplicate": is_dup, "truth_reason_code": code,
                      "truth_reason_bad": submitted != code, "truth_postal_code": zip_code, "truth_state": state,
                      "truth_address_bad": zip_code is None, "truth_contradiction": contradiction, "truth_pii": pii})
    return records, truth


RECORDS_DDL = ("record_id int, company_raw string, order_status string, reason_code string, reason_text string, "
               "address_raw string, comment string, note string")
TRUTH_DDL = ("record_id int, truth_entity int, truth_duplicate boolean, truth_reason_code string, truth_reason_bad boolean, "
             "truth_postal_code string, truth_state string, truth_address_bad boolean, truth_contradiction boolean, truth_pii boolean")


# --- rule SQL -----------------------------------------------------------------------------------
def rule_queries(spec: dict[str, Any], records: str) -> dict[str, str]:
    """One SELECT per check returning (record_id, check_name, verdict, reason). verdict is pass, fail, or unknown."""
    kw = spec["reason"]["keywords"]
    hits = ", ".join(f"if(lower(reason_text) RLIKE {a.sql_string(p)}, {a.sql_string(code)}, CAST(NULL AS STRING))" for code, p in kw.items())
    pii = " OR ".join(f"note RLIKE {a.sql_string(p)}" for p in spec["pii"]["patterns"].values())
    key = f"regexp_replace(regexp_replace(lower(company_raw), '(^| )(inc|llc|ltd|corp|co|company)[.,]?( |$)', ' '), '[^a-z0-9]', '')"
    return {
        "reason_code": f"""
SELECT record_id, 'reason_code' AS check_name,
       CASE WHEN size(hits) <> 1 THEN 'unknown' WHEN hits[0] = reason_code THEN 'pass' ELSE 'fail' END AS verdict,
       CASE WHEN size(hits) <> 1 THEN 'no single keyword match'
            WHEN hits[0] = reason_code THEN 'keyword matches the submitted code'
            ELSE concat('keyword says ', hits[0], ', submitted ', reason_code) END AS reason
FROM (SELECT record_id, reason_code, filter(array({hits}), x -> x IS NOT NULL) AS hits FROM {records})""",
        "address": f"""
SELECT record_id, 'address' AS check_name,
       CASE WHEN address_raw RLIKE {a.sql_string(spec['address']['canonical_pattern'])} THEN 'pass' ELSE 'unknown' END AS verdict,
       CASE WHEN address_raw RLIKE {a.sql_string(spec['address']['canonical_pattern'])} THEN 'matches the canonical pattern'
            ELSE 'not in canonical form' END AS reason
FROM {records}""",
        "duplicate_company": f"""
WITH keyed AS (SELECT record_id, {key} AS k, left({key}, {int(spec['duplicates']['block_chars'])}) AS b FROM {records})
SELECT r.record_id, 'duplicate_company' AS check_name,
       CASE WHEN exists_exact THEN 'fail' WHEN has_candidate THEN 'unknown' ELSE 'pass' END AS verdict,
       CASE WHEN exists_exact THEN 'same normalized name as an earlier record'
            WHEN has_candidate THEN 'earlier record in the same block, names differ' ELSE 'no earlier record in the block' END AS reason
FROM (SELECT k1.record_id,
             exists(collect_list(k2.k), x -> x = k1.k) AS exists_exact,
             count(k2.record_id) > 0 AS has_candidate
      FROM keyed k1 LEFT JOIN keyed k2 ON k1.b = k2.b AND k2.record_id < k1.record_id
      GROUP BY k1.record_id, k1.k) r""",
        "sensitive_note": f"""
SELECT record_id, 'sensitive_note' AS check_name,
       CASE WHEN note IS NULL OR trim(note) = '' THEN 'pass' WHEN {pii} THEN 'fail' ELSE 'unknown' END AS verdict,
       CASE WHEN note IS NULL OR trim(note) = '' THEN 'no note' WHEN {pii} THEN 'email, phone, or SSN pattern'
            ELSE 'free text the patterns cannot clear' END AS reason
FROM {records}""",
        "status_comment": f"""
SELECT record_id, 'status_comment' AS check_name,
       CASE WHEN comment IS NULL OR trim(comment) = '' THEN 'pass' ELSE 'unknown' END AS verdict,
       CASE WHEN comment IS NULL OR trim(comment) = '' THEN 'no comment to contradict the status' ELSE 'comment needs reading' END AS reason
FROM {records}""",
    }


def rule_verdict_reason(spec: dict[str, Any], row: dict[str, Any]) -> str:
    """Python mirror of the reason_code rule, used to size the residue in tests."""
    hits = [c for c, p in spec["reason"]["keywords"].items() if re.search(p, row["reason_text"].lower())]
    if len(hits) != 1:
        return "unknown"
    return "pass" if hits[0] == row["reason_code"] else "fail"


# --- AI call helpers ----------------------------------------------------------------------------
def classify_labels_json(spec: dict[str, Any]) -> str:
    return json.dumps(spec["reason"]["labels"])


def extract_schema_json() -> str:
    return json.dumps({
        "street": {"type": "string", "description": "Street number and name, with any unit"},
        "city": {"type": "string", "description": "City name"},
        "state": {"type": "string", "description": "Two-letter US state code"},
        "postal_code": {"type": "string", "description": "Five-digit US ZIP code, or null when the text has none"},
    })


def response_format_json() -> str:
    """The JSON schema passed to ai_query as responseFormat for the status and comment check."""
    return json.dumps({
        "type": "json_schema",
        "json_schema": {
            "name": "status_comment_check",
            "schema": {
                "type": "object",
                "properties": {
                    "verdict": {"type": "string", "enum": ["pass", "fail"]},
                    "reason": {"type": "string"},
                },
                "required": ["verdict", "reason"],
            },
            "strict": True,
        },
    })


VALIDATION_INSTRUCTIONS = ("You check one order record. The order status is the system of record. Return fail when the "
                           "customer comment contradicts the status, and pass when it is consistent. Give a one-sentence reason.")


def validation_prompt(status: str, comment: str) -> str:
    """The prompt the SQL builds with concat(): instructions, then the status and the comment."""
    return f"{VALIDATION_INSTRUCTIONS} Status: {status}. Comment: {comment}"


def parse_classify(raw: str | None) -> tuple[str | None, float | None, str | None]:
    """Read ai_classify 2.1 output (the VARIANT cast to text) into (label, confidence, error)."""
    if not raw:
        return None, None, "empty response"
    data = json.loads(raw)
    if data.get("error_message"):
        return None, None, str(data["error_message"])
    first = (data.get("response") or [None])[0]
    if not first:
        return None, None, "no label returned"
    return first.get("value"), first.get("confidence_score"), None


def parse_extract(raw: str | None, fields: list[str]) -> tuple[dict[str, Any], str | None]:
    """Read ai_extract 2.1 output into ({field: value}, error)."""
    if not raw:
        return {}, "empty response"
    data = json.loads(raw)
    if data.get("error_message"):
        return {}, str(data["error_message"])
    response = data.get("response") or {}
    return {f: (response.get(f) or {}).get("value") for f in fields}, None


def extract_verdict(values: dict[str, Any], error: str | None) -> tuple[str, str]:
    if error:
        return "review", f"ai_extract error: {error}"
    if valid_postal_code(values.get("postal_code")):
        return "pass", "a five-digit postal code was found"
    return "fail", "no valid postal code in the address"


def mask_verdict(original: str | None, masked: str | None) -> tuple[str, str]:
    """ai_mask replaces sensitive spans with [MASKED]. Any change means the note held sensitive text."""
    if masked is None:
        return "review", "ai_mask returned NULL"
    if masked != original:
        return "fail", f"ai_mask masked {masked.count('[MASKED]')} span(s)"
    return "pass", "ai_mask found nothing to mask"


def split_query_struct(payload: str | None) -> tuple[str | None, str | None]:
    """Read to_json(ai_query(..., failOnError => false)) into (response text, error). The docs name the field
    `response`; `result` is accepted too so an older runtime does not turn every row into review."""
    if not payload:
        return None, "empty struct"
    data = json.loads(payload)
    return data.get("response", data.get("result")), data.get("errorMessage")


def parse_verdict(raw: str | None) -> tuple[str, str]:
    """Read ai_query's JSON text into (verdict, reason). Anything unreadable becomes ('review', why)."""
    if not raw:
        return "review", "empty response"
    try:
        data = json.loads(raw)
        verdict = str(data["verdict"]).lower()
    except (ValueError, KeyError, TypeError):
        return "review", "response was not the expected JSON"
    if verdict not in ("pass", "fail"):
        return "review", f"unexpected verdict {verdict}"
    return verdict, str(data.get("reason", ""))


def valid_postal_code(value: str | None) -> bool:
    return bool(value) and re.fullmatch(r"[0-9]{5}", str(value).strip()) is not None


def similarity_verdict(score: float | None, fail_at: float, pass_below: float) -> str:
    if score is None:
        return "review"
    if score >= fail_at:
        return "fail"
    return "pass" if score < pass_below else "review"


def classify_verdict(predicted: str | None, confidence: float | None, submitted: str, min_confidence: float) -> tuple[str, str]:
    if predicted is None or confidence is None or confidence < min_confidence:
        return "review", "low confidence or no label"
    return ("pass", "model agrees with the submitted code") if predicted == submitted else ("fail", f"model says {predicted}, submitted {submitted}")


# --- scoring ------------------------------------------------------------------------------------
def confusion(pairs: list[tuple[bool, str]]) -> dict[str, float]:
    """pairs are (truth_is_bad, verdict). 'fail' is the positive class; 'review' rows are counted apart, not guessed."""
    tp = sum(bad and v == "fail" for bad, v in pairs)
    fp = sum((not bad) and v == "fail" for bad, v in pairs)
    fn = sum(bad and v == "pass" for bad, v in pairs)
    tn = sum((not bad) and v == "pass" for bad, v in pairs)
    review = sum(v == "review" for _, v in pairs)
    bad_total = sum(bad for bad, _ in pairs)
    return {
        "rows": float(len(pairs)), "tp": float(tp), "fp": float(fp), "fn": float(fn), "tn": float(tn), "review": float(review),
        "precision": tp / (tp + fp) if tp + fp else 1.0,
        "recall": tp / (tp + fn) if tp + fn else 1.0,
        "review_share": review / len(pairs) if pairs else 0.0,
        "missed_in_review": float(sum(bad and v == "review" for bad, v in pairs)) / bad_total if bad_total else 0.0,
    }


def gate(metrics: dict[str, float], thresholds: dict[str, Any]) -> str:
    """'ok', or the first threshold the check misses."""
    if metrics["precision"] < thresholds["min_precision"]:
        return "precision below threshold"
    if metrics["recall"] < thresholds["min_recall"]:
        return "recall below threshold"
    if metrics["review_share"] > thresholds["max_review_share"]:
        return "too many rows in human review"
    return "ok"


def residue_share(unknown: int, total: int) -> float:
    return unknown / total if total else 0.0


def estimate_tokens(chars: int, chars_per_token: float = 4.0) -> int:
    return int(round(chars / chars_per_token))


def per_thousand(total: float | None, rows: int) -> float | None:
    if total is None or not rows:
        return None
    return total / rows * 1000


# --- tables -------------------------------------------------------------------------------------
def combine_sql(rule_table: str, ai_table: str) -> str:
    """Rule verdicts that settled a record, plus the AI verdicts for the records they left unknown."""
    return f"""
SELECT record_id, check_name, 'rule' AS source, verdict, reason, CAST(NULL AS DOUBLE) AS confidence, current_timestamp() AS checked_at
FROM {rule_table} WHERE verdict <> 'unknown'
UNION ALL
SELECT record_id, check_name, 'ai' AS source, verdict, reason, confidence, current_timestamp() AS checked_at FROM {ai_table}"""


def quarantine_sql(quality: str) -> str:
    return f"""
SELECT record_id,
       array_sort(collect_set(CASE WHEN verdict = 'fail' THEN check_name END)) AS failed_checks,
       array_sort(collect_set(CASE WHEN verdict = 'review' THEN check_name END)) AS review_checks,
       concat_ws('; ', collect_list(CASE WHEN verdict <> 'pass' THEN concat(check_name, ': ', reason) END)) AS reasons,
       current_timestamp() AS quarantined_at
FROM {quality} GROUP BY record_id HAVING max(CASE WHEN verdict IN ('fail', 'review') THEN 1 ELSE 0 END) = 1"""
