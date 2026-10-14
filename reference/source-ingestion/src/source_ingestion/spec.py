"""Load the use-case spec that drives every sample dataset in this bundle."""

from __future__ import annotations

from typing import Any

import yaml


def load_spec(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return yaml.safe_load(handle)
