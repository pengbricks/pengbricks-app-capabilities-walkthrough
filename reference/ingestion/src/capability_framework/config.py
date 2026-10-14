"""Feed configuration: everything that differs between sources lives here, not in code."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

CANONICAL_COLUMNS = ("record_id", "account_id", "event_ts", "amount", "currency", "status")


@dataclass(frozen=True)
class Rule:
    name: str
    type: str
    column: str | None = None
    expr: str | None = None
    values: tuple[str, ...] = ()


@dataclass(frozen=True)
class FeedConfig:
    name: str
    adapter: str
    format: str
    options: dict[str, str]
    mapping: dict[str, str]
    keys: tuple[str, ...]
    rules: tuple[Rule, ...] = field(default_factory=tuple)

    def landing_path(self, catalog: str, schema: str) -> str:
        return f"/Volumes/{catalog}/{schema}/landing/{self.name}/"


def parse_feed(raw: dict[str, Any]) -> FeedConfig:
    missing = [column for column in CANONICAL_COLUMNS if column not in raw.get("mapping", {})]
    if missing:
        raise ValueError(f"Feed {raw.get('name')} does not map canonical columns: {', '.join(missing)}")

    rules = tuple(
        Rule(
            name=rule["name"],
            type=rule["type"],
            column=rule.get("column"),
            expr=rule.get("expr"),
            values=tuple(rule.get("values", ())),
        )
        for rule in raw.get("rules", ())
    )
    return FeedConfig(
        name=raw["name"],
        adapter=raw.get("adapter", "generic"),
        format=raw["source"]["format"],
        options={key: str(value) for key, value in raw["source"].get("options", {}).items()},
        mapping=dict(raw["mapping"]),
        keys=tuple(raw["keys"]),
        rules=rules,
    )


def load_feed(feeds_dir: str | Path, name: str) -> FeedConfig:
    path = Path(feeds_dir) / f"{name}.yml"
    with path.open(encoding="utf-8") as handle:
        return parse_feed(yaml.safe_load(handle))
