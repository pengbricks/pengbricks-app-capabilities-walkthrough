"""Use-case specs: one YAML file per tenant or use case drives data, feeds, rules, and tags."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from .config import CANONICAL_COLUMNS


def load_use_case(path: str | Path) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as handle:
        spec = yaml.safe_load(handle)
    validate_use_case(spec)
    return spec


def validate_use_case(spec: dict[str, Any]) -> None:
    columns = {column["name"] for column in spec["entity"]["columns"]}
    missing = [column for column in CANONICAL_COLUMNS if column not in columns]
    if missing:
        raise ValueError(f"Use case {spec.get('name')} is missing canonical columns: {', '.join(missing)}")
    names = [feed["name"] for feed in spec["feeds"]]
    if len(names) != len(set(names)):
        raise ValueError(f"Use case {spec.get('name')} has duplicate feed names")
    for feed in spec["feeds"]:
        unmapped = [column for column in CANONICAL_COLUMNS if column not in feed["mapping"]]
        if unmapped:
            raise ValueError(f"Feed {feed['name']} does not map: {', '.join(unmapped)}")


def render_feed(spec: dict[str, Any], feed: dict[str, Any]) -> dict[str, Any]:
    """Render the framework feed config for one feed. Output is deterministic for a given spec."""
    # The rendered config is everything the shared framework needs; nothing else is per feed.
    return {
        "name": feed["name"],
        "adapter": feed.get("adapter", "generic"),
        "source": {"format": feed["format"], "options": dict(feed.get("options", {}))},
        "mapping": {column: feed["mapping"][column] for column in CANONICAL_COLUMNS},
        "keys": list(spec["entity"]["keys"]),  # merge keys are shared across feeds
        # Shared rules first, then any rules specific to this feed.
        "rules": [dict(rule) for rule in spec.get("rules", [])] + [dict(rule) for rule in feed.get("rules", [])],
    }


def render_feeds(spec: dict[str, Any]) -> dict[str, str]:
    """Return {file name: YAML text} for every feed in the use case."""
    header = f"# Generated from use_cases/{spec['name']}.yml by tools/render_use_case.py. Do not edit.\n"
    return {
        f"{feed['name']}.yml": header + yaml.safe_dump(render_feed(spec, feed), sort_keys=False)
        for feed in spec["feeds"]
    }


def feed_names(spec: dict[str, Any]) -> list[str]:
    return [feed["name"] for feed in spec["feeds"]]
