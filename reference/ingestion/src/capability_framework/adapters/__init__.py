"""Provider adapters: the only place provider-specific code is allowed.

Most feeds use the generic adapter and are onboarded with configuration alone.
A provider gets its own adapter only when its quirks cannot be expressed as a mapping.
"""

from __future__ import annotations

from typing import Callable

from . import generic, provider_a

Adapter = Callable  # (spark, FeedConfig, landing_path) -> DataFrame with canonical columns

ADAPTERS: dict[str, Adapter] = {
    "generic": generic.read,
    "provider_a": provider_a.read,
}


def get_adapter(name: str) -> Adapter:
    """Look up the reader for a feed's `adapter` setting; unknown names fail fast."""
    try:
        return ADAPTERS[name]
    except KeyError as error:
        raise ValueError(f"Unknown adapter {name}; register it in adapters/__init__.py") from error
