"""Extract highlighted code from reference/ into server/artifact_snippets.json.

    python scripts/build_artifact_snippets.py          # regenerate
    python scripts/build_artifact_snippets.py --check  # fail when snippets are stale

Python highlights name a `symbol` (function or class) and are cut with `ast`, so line
numbers stay correct as files change. Other files use an explicit `lines` range or their first MAX_LINES lines.
The app runtime ships only server/, so snippets are embedded rather than read at request time.
"""

from __future__ import annotations

import argparse
import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "server" / "artifacts.json"
OUTPUT = ROOT / "server" / "artifact_snippets.json"
MAX_LINES = 40


def python_symbol(source: str, symbol: str) -> tuple[int, int]:
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name == symbol:
            start = min([node.lineno, *[decorator.lineno for decorator in node.decorator_list]])
            return start, node.end_lineno or node.lineno
    raise ValueError(f"{symbol} not found")


def extract(highlight: dict) -> dict:
    path = ROOT / highlight["path"]
    lines = path.read_text(encoding="utf-8").splitlines()
    if highlight.get("symbol"):
        start, end = python_symbol("\n".join(lines), highlight["symbol"])
    elif highlight.get("lines"):
        start, end = highlight["lines"]
    else:
        start, end = 1, min(len(lines), MAX_LINES)
    end = min(end, start + MAX_LINES - 1)
    return {
        "path": highlight["path"],
        "symbol": highlight.get("symbol"),
        "startLine": start,
        "endLine": end,
        "language": path.suffix.lstrip(".") or "text",
        "code": "\n".join(lines[start - 1 : end]),
    }


def build() -> str:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    snippets = {
        slug: [extract(item) for item in guide.get("highlights", [])]
        for slug, guide in sorted(index["guides"].items())
    }
    return json.dumps(snippets, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rendered = build()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != rendered:
            print("server/artifact_snippets.json is stale. Run: python scripts/build_artifact_snippets.py")
            return 1
        print("Artifact snippets are current.")
        return 0
    OUTPUT.write_text(rendered, encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
