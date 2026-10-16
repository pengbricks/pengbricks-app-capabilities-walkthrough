"""Fixed names and id ranges for the streaming sample batches, so a rerun lands the same files."""

from __future__ import annotations

STREAM_ID_BASE = 1_000_000_000  # keeps streaming event ids clear of the batch feeds' ids


def batch_file_name(batch: int) -> str:
    """Fixed name for streaming batch `batch` (0-based). The same batch always maps to the same file."""
    return f"events_batch_{batch + 1:04d}.json"


def batch_id_offset(batch: int, rows_per_batch: int) -> int:
    """Fixed id range for a batch, so its events keep the same ids on every run."""
    return STREAM_ID_BASE + batch * rows_per_batch
