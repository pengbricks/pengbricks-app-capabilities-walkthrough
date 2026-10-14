"""Load the use-case spec."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


def load_spec(path: str | Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        spec = yaml.safe_load(handle)
    for name, table in spec["tables"].items():
        if not table.get("columns"):
            raise ValueError(f"table {name} has no columns")
    return spec
