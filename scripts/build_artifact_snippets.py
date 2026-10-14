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
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "server" / "artifacts.json"
OUTPUT = ROOT / "server" / "artifact_snippets.json"
SAMPLES_OUTPUT = ROOT / "server" / "artifact_samples.json"
MAX_LINES = 40


def python_symbol(source: str, symbol: str) -> tuple[int, int]:
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name == symbol:
            start = min([node.lineno, *[decorator.lineno for decorator in node.decorator_list]])
            return start, node.end_lineno or node.lineno
    raise ValueError(f"{symbol} not found")


def bundle_function_docs(path: str) -> dict[str, str]:
    """First docstring sentence of every function in the highlighted file's bundle (reference/<bundle>)."""
    parts = Path(path).parts
    root = ROOT / Path(*parts[:2]) if parts[0] == "reference" and len(parts) > 2 else (ROOT / path).parent
    docs: dict[str, str] = {}
    for file in sorted(root.rglob("*.py")):
        if "tests" in file.parts or ".databricks" in file.parts:
            continue
        try:
            tree = ast.parse(file.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                doc = ast.get_docstring(node)
                if doc and node.name not in docs and node.name != "main":
                    docs[node.name] = doc.strip().split("\n\n")[0].replace("\n", " ")
    return docs


def referenced_functions(code: str, docs: dict[str, str]) -> dict[str, str]:
    names = set(re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(", code))
    return {name: docs[name] for name in sorted(names) if name in docs}


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
    code = "\n".join(lines[start - 1 : end])
    return {
        "path": highlight["path"],
        "symbol": highlight.get("symbol"),
        "startLine": start,
        "endLine": end,
        "language": path.suffix.lstrip(".") or "text",
        "code": code,
        "functions": referenced_functions(code, bundle_function_docs(highlight["path"])),
    }


def build() -> str:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    snippets = {
        slug: [extract(item) for item in guide.get("highlights", [])]
        for slug, guide in sorted(index["guides"].items())
    }
    return json.dumps(snippets, indent=2) + "\n"


def build_samples() -> str:
    """Embed Auto Loader example documents so the app can prefill its drop panel."""
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    samples = {
        slug: [
            {"label": item["label"], "path": item["path"], "content": (ROOT / item["path"]).read_text(encoding="utf-8").strip()}
            for item in guide["autoLoaderDrop"]["samples"]
        ]
        for slug, guide in sorted(index["guides"].items())
        if guide.get("autoLoaderDrop")
    }
    return json.dumps(samples, indent=2) + "\n"


def guide_paths(guide: dict) -> list[str]:
    items = guide["code"] + guide.get("highlights", []) + guide.get("walkthroughs", [])
    return [guide["onePager"], guide["bundle"], *(item["path"] for item in items)]


def last_updated(paths: list[str]) -> str:
    """Date of the last commit touching any path, or today when one has uncommitted changes."""
    import datetime
    import subprocess

    existing = [path for path in paths if (ROOT / path).exists()]
    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--", *existing], cwd=ROOT, capture_output=True, text=True
    ).stdout.strip()
    if dirty:
        return datetime.date.today().isoformat()
    committed = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", *existing], cwd=ROOT, capture_output=True, text=True
    ).stdout.strip()
    return committed or datetime.date.today().isoformat()


def write_guide_updates() -> None:
    """client/src/data/guideUpdates.json: last updated date per guide, from Git history."""
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    updates = {slug: last_updated(guide_paths(guide)) for slug, guide in sorted(index["guides"].items())}
    updates["*"] = last_updated(["client/src/data/guides.ts"])
    (ROOT / "client" / "src" / "data" / "guideUpdates.json").write_text(json.dumps(updates, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rendered = build()
    samples = build_samples()
    if args.check:
        stale = [
            path.name for path, text in ((OUTPUT, rendered), (SAMPLES_OUTPUT, samples))
            if not path.exists() or path.read_text(encoding="utf-8") != text
        ]
        if stale:
            print(f"Stale: {', '.join(stale)}. Run: python scripts/build_artifact_snippets.py")
            return 1
        print("Artifact snippets are current.")
        return 0
    write_guide_updates()
    OUTPUT.write_text(rendered, encoding="utf-8")
    SAMPLES_OUTPUT.write_text(samples, encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} and {SAMPLES_OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
