"""Runs the same pytest suite on Databricks serverless. Fails the task on any test failure."""
import sys

sys.dont_write_bytecode = True  # workspace files cannot hold __pycache__

from pathlib import Path  # noqa: E402

import pytest  # noqa: E402

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "src"))

code = pytest.main([str(root / "tests"), "-v", "-p", "no:cacheprovider"])
if code != 0:
    raise SystemExit(f"pytest failed with exit code {int(code)}")
