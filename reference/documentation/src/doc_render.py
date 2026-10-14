"""Pure helpers (no Spark) for parsing model output and rendering markdown pages."""
import json
import re


def sql_str(value: str) -> str:
    """Escape a value for use inside a single-quoted SQL string literal."""
    return str(value).replace("\\", "\\\\").replace("'", "''")


def parse_ai_json(text: str) -> dict:
    """Extract the first JSON object from model output; return {} if none parses."""
    if not text:
        return {}
    text = re.sub(r"```(?:json)?", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def clean_comment(text, limit: int = 400) -> str:
    """Single-line comment text, truncated."""
    s = " ".join(str(text or "").split())
    return s if len(s) <= limit else s[: limit - 3].rstrip() + "..."


def pct(value) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def md_table(headers, rows) -> str:
    if not rows:
        return ""
    esc = lambda v: str(v if v is not None else "").replace("|", "\\|").replace("\n", " ")
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(esc(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def render_table_page(t: dict) -> str:
    """Render one table's page. `t` keys: full_name, description, owner, tags, columns,
    upstream, downstream, row_count, key_column, key_unique, readers, queries, generated_at, model."""
    L = [f"# {t['full_name']}", ""]
    L += [t.get("description") or "_No description generated._", ""]

    L += ["## Ownership", "", f"- Owner: `{t.get('owner') or 'unknown'}`"]
    tags = t.get("tags") or []
    L += ["- Tags: " + (", ".join(f"`{k}={v}`" for k, v in tags) if tags else "none"), ""]

    L += ["## Schema", ""]
    L += [md_table(["Column", "Type", "Null rate", "Description"],
                   [(c["name"], c["type"], pct(c.get("null_rate")), c.get("description", "")) for c in t["columns"]]), ""]

    L += ["## Quality", "", f"- Row count: {t.get('row_count', 'n/a'):,}" if isinstance(t.get("row_count"), int)
          else "- Row count: n/a"]
    kc = t.get("key_column")
    if kc:
        L.append(f"- Key candidate `{kc}`: {'unique' if t.get('key_unique') else 'NOT unique'}"
                 f" ({t.get('key_distinct', 'n/a')} distinct values)")
    L.append("")

    L += ["## Lineage", ""]
    for label, key in (("Upstream", "upstream"), ("Downstream", "downstream")):
        items = t.get(key) or []
        L.append(f"- {label}: " + (", ".join(f"`{i}`" for i in items) if items else "none recorded"))
    L.append("")

    L += ["## Usage guidance", ""]
    readers = t.get("readers") or []
    if readers:
        L += [md_table(["Reader", "Reads (30d)", "Last read"], readers), ""]
    else:
        L += ["No recent readers found in `system.access.table_lineage` (system tables can lag by minutes to hours).", ""]
    queries = t.get("queries") or []
    if queries:
        L += ["Recent queries from `system.query.history`:", ""]
        L += [f"- `{' '.join(str(q).split())[:160]}`" for q in queries]
        L.append("")
    else:
        L += ["No recent queries found in `system.query.history`.", ""]
    if t.get("usage_guidance"):
        L += [t["usage_guidance"], ""]

    L += ["---", f"Generated {t.get('generated_at', '')} with `{t.get('model', '')}`. "
          "Descriptions are AI drafts; review before relying on them."]
    return "\n".join(L) + "\n"


def render_index(tables, generated_at: str) -> str:
    rows = [(f"[{t['name']}]({t['name']}.md)", t.get("owner") or "", t.get("row_count", ""),
             clean_comment(t.get("summary", ""), 120)) for t in tables]
    L = ["# Table documentation index", "", f"Generated {generated_at}. {len(tables)} tables.", "",
         md_table(["Table", "Owner", "Rows", "Summary"], rows), ""]
    return "\n".join(L)
