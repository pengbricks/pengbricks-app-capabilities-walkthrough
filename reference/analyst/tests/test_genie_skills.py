import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from analyst_common import genie_skills as s

SKILL_DIR = Path(__file__).resolve().parents[1] / "guides" / "genie-code" / "skills"
GOOD = "---\nname: my-skill\ndescription: Does a thing. Use when asked.\n---\n# Body\n"


def test_locations_match_docs():
    assert s.user_skills_root("a@x.com") == "/Users/a@x.com/.assistant/skills"
    assert s.workspace_skills_root() == "/Workspace/.assistant/skills"
    assert s.user_instructions_path("a@x.com") == "/Users/a@x.com/.assistant_instructions.md"
    assert s.workspace_instructions_path() == "/Workspace/.assistant_workspace_instructions.md"


def test_skills_root_rejects_unknown_scope():
    assert s.skills_root("workspace", "a") == "/Workspace/.assistant/skills"
    try:
        s.skills_root("account", "a")
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_parse_frontmatter():
    assert s.parse_frontmatter(GOOD) == {"name": "my-skill", "description": "Does a thing. Use when asked."}
    assert s.parse_frontmatter("# no front matter") == {}
    assert s.parse_frontmatter("---\nname: x\n") == {}


def test_validate_skill_ok_and_failures():
    assert s.validate_skill(GOOD, "my-skill") == []
    assert any("match the folder" in p for p in s.validate_skill(GOOD, "other"))
    assert any("missing description" in p for p in s.validate_skill("---\nname: a\n---\n", "a"))
    assert any("lowercase" in p for p in s.validate_skill("---\nname: Bad_Name\ndescription: d\n---\n", "Bad_Name"))
    assert s.validate_skill("hello", "x")
    long = "---\nname: a\ndescription: " + "d" * 1025 + "\n---\n"
    assert any("limit" in p for p in s.validate_skill(long, "a"))


def test_bundled_example_skill_is_valid():
    text = (SKILL_DIR / "gc-sample-data" / "SKILL.md").read_text()
    assert s.validate_skill(text, "gc-sample-data") == []


def test_bundled_instructions_fit_limit():
    text = (SKILL_DIR.parent / "instructions.md").read_text()
    assert s.check_instructions(text) == []


def test_check_instructions_limits():
    assert s.check_instructions("") and s.check_instructions("x" * 20_001)
    assert s.check_instructions("x" * 20_000) == []


def test_needs_write_is_idempotent():
    assert s.needs_write(b"a", None)
    assert s.needs_write(b"a", b"b")
    assert not s.needs_write(b"a", b"a")


def test_plan_skill_copies_skips_hidden_and_loose_files():
    plan = s.plan_skill_copies(["b/SKILL.md", "a/scripts/x.py", "a/SKILL.md", "a/.DS_Store", "README.md"], "/Users/u/.assistant/skills")
    assert [c.target for c in plan] == [
        "/Users/u/.assistant/skills/a/SKILL.md",
        "/Users/u/.assistant/skills/a/scripts/x.py",
        "/Users/u/.assistant/skills/b/SKILL.md",
    ]


def test_publish_steps_name_the_shared_folder():
    steps = s.publish_steps(["gc-sample-data"])
    assert any("import-dir" in t and "/Workspace/.assistant/skills/gc-sample-data" in t and "--overwrite" in t for t in steps)
