"""Load the use-case spec."""

from __future__ import annotations

from typing import Any


def load_spec(path: str) -> dict[str, Any]:
    import yaml

    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)
