"""The simulated outage that shows a job's retry policy working."""

from __future__ import annotations

from .runner import TransientSourceError


def simulate_transient_failure(dbutils, catalog: str, schema: str, run_id: str) -> None:
    """Fail the first attempt of a run so the job's retry policy is exercised; later attempts pass."""
    marker = f"/Volumes/{catalog}/{schema}/landing/_markers/transient-{run_id}"
    try:
        # The marker exists only after the first attempt, so a retry passes.
        dbutils.fs.ls(marker)
        print("Retry attempt: transient condition cleared")
    except Exception:
        dbutils.fs.put(marker, "first attempt failed on purpose", True)
        raise TransientSourceError("Simulated transient source outage on first attempt; the job retry policy will rerun")
