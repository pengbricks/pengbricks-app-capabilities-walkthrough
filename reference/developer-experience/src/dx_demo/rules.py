"""Plain-Python row rules. They run in local tests without Spark."""
from typing import Optional, Sequence, Tuple


def normalize_key(raw: Optional[str]) -> Optional[str]:
    """Trim and upper-case a key. Blank or null keys become None."""
    if raw is None:
        return None
    value = raw.strip().upper()
    return value or None


def is_valid_value(value: Optional[float]) -> bool:
    """A measure is valid when it is present and not negative."""
    return value is not None and value >= 0


def band_for(value: float, thresholds: Sequence[Tuple[float, str]], default: str) -> str:
    """thresholds are (min, label) pairs, checked from highest min to lowest."""
    for minimum, label in sorted(thresholds, reverse=True):
        if value >= minimum:
            return label
    return default
