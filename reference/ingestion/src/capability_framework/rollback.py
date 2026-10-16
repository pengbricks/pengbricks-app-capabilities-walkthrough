"""Choosing the Delta version a rollback restores."""

from __future__ import annotations


def choose_target(history: list[tuple[int, str]], version: str = "") -> int | None:
    """Pick the version to restore, or None when a rerun has nothing left to undo.

    `history` is (version, operation) newest first. With no explicit version the target is the
    version before the latest write. If the latest entry is already a RESTORE, that write was
    undone, so a rerun does nothing; otherwise each rerun would undo the previous rollback.
    """
    if version:
        return int(version)
    if len(history) < 2:
        raise RuntimeError("table has no earlier version to restore")
    if history[0][1] == "RESTORE":
        return None
    return history[1][0]
