"""Render feed configs for a use case.

    python tools/render_use_case.py use_cases/general.yml          # write feeds/general/*.yml
    python tools/render_use_case.py use_cases/general.yml --check  # fail if committed feeds drifted

A new use case is one new spec file plus one run of this script.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT / "src"))

from capability_framework.use_case import load_use_case, render_feeds  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("spec", type=Path)
    parser.add_argument("--check", action="store_true", help="verify rendered feeds match the files on disk")
    args = parser.parse_args()

    spec = load_use_case(args.spec)
    out_dir = BUNDLE_ROOT / "feeds" / spec["name"]
    rendered = render_feeds(spec)

    if args.check:
        drifted = [
            name for name, text in rendered.items()
            if not (out_dir / name).exists() or (out_dir / name).read_text(encoding="utf-8") != text
        ]
        if drifted:
            print(f"Feeds out of date for {spec['name']}: {', '.join(drifted)}. Rerun without --check.")
            return 1
        print(f"Feeds up to date for {spec['name']}.")
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    for name, text in rendered.items():
        (out_dir / name).write_text(text, encoding="utf-8")
    print(f"Wrote {len(rendered)} feed configs to {out_dir.relative_to(BUNDLE_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
