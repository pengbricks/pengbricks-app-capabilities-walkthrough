"""Import designed walkthrough pages into the app.

    python scripts/import_walkthrough_templates.py <folder-with-guides_*.html>

Each guides_<name>.html becomes client/public/walkthroughs/<guide-slug>.html, served at
/capability-guides/walkthroughs/<guide-slug>.html. The import keeps the design (styles, diagrams,
glossary hover script) and removes what does not belong in this public, generic app:
  - the Status section and its table-of-contents link
  - references to another app's screens (#/... routes, "App screen", "Interactive walkthrough")
  - tracker and evaluation wording, and source-specific feed names
Links are rewritten to the app's guide pages and to sibling walkthroughs.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "client" / "public" / "walkthroughs"

# Template file names that differ from guide slugs.
SLUGS = {"batch-and-real-time": "batch-real-time-ingestion"}

# Elements removed whole when their text matches.
DROP_ELEMENT = re.compile(
    r"App screen|Also in the app|Show it in the app|Interactive walkthrough|Tracker gap|Feed names|"
    r"No app screen|No combined page on the app screen|Evaluation Guide|in the tracker|#/[a-z][a-z-]*(?:/[a-z-]+)?</code>|"
    r"Gap:</strong>|>Gap:|app screen|tracker|Name the gap",
    re.I,
)
# Sections about the source tracker or another app, removed whole along with their contents links.
DROP_SECTIONS = ("status", "app-vs-repo", "gaps", "gap", "editor")
DROPPABLE = ("tr", "li", "p", "a")

TEXT_REPLACEMENTS = [
    (r"Explainer · due [^<]*", "Walkthrough"),
    (r"The tracker gap reads: [^<]*", ""),
    (r"the parts of the criterion with no recorded run yet", "next steps the reference run does not cover"),
    (r"the criterion asks for", "this guide covers"),
    (r"criterion", "guide"),
    (r"Evidence: what is measured and what is not", "What the reference run measures"),
    (r"Evidence from the reference run", "Reference run results"),
    (r"Evidence: both feeds, same rules", "Both feeds, same rules"),
    (r"Where it lives, demo steps, and gaps", "Where it lives and demo steps"),
    (r">Evidence<", ">Reference run<"),
    (r"NOT SHOWN YET", "NEXT STEP"),
    (r"Not shown yet", "Next step"),
    (r"items not shown yet", "items left as next steps"),
    (r"not shown yet", "next step"),
    (r"The tracker gap reads: ", "Not covered yet: "),
    (r"The tracker records one gap for this evaluation\.", "One gap remains."),
    (r"That difference is the tracker gap\.", "That difference is the remaining gap."),
    (r"Tracker gap: ", "Gap: "),
    (r"Tracker gap", "Gap"),
    (r"tracker gap", "gap"),
    (r"Related evaluations", "Related guides"),
    (r"Related evaluation", "Related guide"),
    (r"this evaluation", "this guide"),
    (r"evaluations", "guides"),
    (r"evaluation", "guide"),
    (r"Evaluation", "Guide"),
]


def slug_for(path: Path) -> str:
    name = path.stem.removeprefix("guides_")
    return SLUGS.get(name, name)


def drop_elements(html: str) -> str:
    """Remove innermost tr/li/p/a elements whose content matches DROP_ELEMENT."""
    for tag in DROPPABLE:
        pattern = re.compile(rf"<{tag}\b[^>]*>(?:(?!<{tag}\b).)*?</{tag}>", re.S)
        html = pattern.sub(lambda m: "" if DROP_ELEMENT.search(m.group(0)) else m.group(0), html)
    return html


def rewrite_links(html: str, slugs: set[str]) -> str:
    html = re.sub(r'href="\.\./index\.html#/eval/([a-z0-9-]+)"', r'href="../guides/\1"', html)
    html = re.sub(r'href="\.\./index\.html#/[^"]*"', 'href="../"', html)

    def sibling(match: re.Match) -> str:
        name = match.group(1)
        slug = SLUGS.get(name, name)
        if name == "environment-separation":
            return 'href="environment-separation"'
        return f'href="{slug}.html"' if slug in slugs else 'href="../"'

    html = re.sub(r'href="([a-z0-9-]+)\.html"', sibling, html)
    return html


def guide_titles() -> dict[str, str]:
    source = (ROOT / "client" / "src" / "data" / "guides.ts").read_text(encoding="utf-8")
    return dict(re.findall(r"slug: '([a-z0-9-]+)',\s*title: '([^']+)'", source))


def guide_descriptions() -> dict[str, str]:
    source = (ROOT / "client" / "src" / "data" / "guides.ts").read_text(encoding="utf-8")
    return {
        slug: text.replace("\\'", "'")
        for slug, text in re.findall(r"slug: '([a-z0-9-]+)',.*?acceptanceCriteria:\s*'((?:[^'\\]|\\.)*)'", source, re.S)
    }


def retitle(html: str, title: str, description: str | None) -> str:
    html = re.sub(r"<title>[^<:]*", f"<title>{title}", html, count=1)
    html = re.sub(r"<h1>[^<]*", f"<h1>{title}", html, count=1)
    if description:
        # The template subtitle repeats source wording; use the guide's own description.
        html = re.sub(r'(<p class="hero-sub">).*?(</p>)', lambda m: m.group(1) + description + m.group(2), html, count=1, flags=re.S)
    return html


# The shared stylesheet uses .guide for a small callout box; the page's <main class="main guide">
# must not pick up its width, background, and type size.
LAYOUT_FIX = """<style data-import="layout-fix">
main.main.guide { max-width: none; background: none; border-radius: 0; font-size: var(--fs-16); line-height: 1.5;
  padding: var(--s-48) var(--s-48) var(--s-64); }
@media (max-width: 720px) { main.main.guide { padding: var(--s-24) var(--s-16) var(--s-48); } }
</style>
"""


def clean(html: str, slugs: set[str]) -> str:
    html = html.replace("</head>", LAYOUT_FIX + "</head>", 1)
    html = re.sub(r"\s*<!-- ─+ Status ─+ -->", "", html)
    for section in DROP_SECTIONS:
        html = re.sub(
            rf'\s*<section\b(?:(?!<section\b).)*?(?:id="{section}"|aria-labelledby="h-{section}")(?:(?!<section\b).)*?</section>',
            "",
            html,
            flags=re.S,
        )
        html = re.sub(rf'\s*<a href="#{section}"[^>]*>.*?</a>', "", html, flags=re.S)
    # "Gaps" tables inside other sections.
    html = re.sub(r'\s*<h3 class="table-title" id="t-gaps">.*?</h3>\s*<div class="table-wrap".*?</table>\s*</div>', "", html, flags=re.S)
    html = drop_elements(html)
    # Diagram labels that cite another app's routes.
    html = re.sub(r"\s*·\s*<tspan[^>]*>#/[^<]*</tspan>", "", html)
    for old, new in TEXT_REPLACEMENTS:
        html = re.sub(old, new, html)
    return rewrite_links(html, slugs)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    sources = sorted(Path(sys.argv[1]).glob("guides_*.html"))
    slugs = {slug_for(path) for path in sources}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    titles = guide_titles()
    descriptions = guide_descriptions()
    for path in sources:
        slug = slug_for(path)
        target = OUTPUT / f"{slug}.html"
        html = clean(path.read_text(encoding="utf-8"), slugs)
        target.write_text(retitle(html, titles.get(slug, slug), descriptions.get(slug)), encoding="utf-8")
        print(f"{path.name} -> {target.relative_to(ROOT)}")
    # The guide page links these designed pages; keep the list next to the data walkthroughs.
    designed = sorted(path.stem for path in OUTPUT.glob("*.html"))
    (ROOT / "client" / "src" / "data" / "walkthroughs" / "designed.json").write_text(
        json.dumps(designed, indent=2) + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
