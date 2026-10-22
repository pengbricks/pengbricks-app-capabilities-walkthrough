"""Pure helpers for installing Genie Code skills and instructions: locations, validation, install plans.

Locations come from the Genie Code docs (skills and instructions pages):
  user skills       /Users/<user>/.assistant/skills/<name>/SKILL.md
  workspace skills  /Workspace/.assistant/skills/<name>/SKILL.md
  user instructions       /Users/<user>/.assistant_instructions.md
  workspace instructions  /Workspace/.assistant_workspace_instructions.md
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Iterable

SKILLS_DIR = ".assistant/skills"
SKILL_FILE = "SKILL.md"
USER_INSTRUCTIONS_FILE = ".assistant_instructions.md"
WORKSPACE_INSTRUCTIONS_FILE = ".assistant_workspace_instructions.md"
INSTRUCTIONS_LIMIT = 20_000  # characters, per the instructions page

# Name and description limits come from the open Agent Skills standard (agentskills.io) that the docs cite.
NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
NAME_MAX = 64
DESCRIPTION_MAX = 1024


def user_skills_root(user_name: str) -> str:
    return f"/Users/{user_name}/{SKILLS_DIR}"


def workspace_skills_root() -> str:
    return f"/Workspace/{SKILLS_DIR}"


def user_instructions_path(user_name: str) -> str:
    return f"/Users/{user_name}/{USER_INSTRUCTIONS_FILE}"


def workspace_instructions_path() -> str:
    return f"/Workspace/{WORKSPACE_INSTRUCTIONS_FILE}"


def skills_root(scope: str, user_name: str) -> str:
    """Target folder for a scope, 'user' or 'workspace'."""
    if scope == "user":
        return user_skills_root(user_name)
    if scope == "workspace":
        return workspace_skills_root()
    raise ValueError(f"scope must be 'user' or 'workspace', got {scope!r}")


def parse_frontmatter(text: str) -> dict[str, str]:
    """Read the simple `key: value` lines between the leading --- markers. Returns {} when there is none."""
    lines = text.lstrip("﻿").splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    out: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return out
        if ":" in line and not line.startswith((" ", "\t")):
            key, _, value = line.partition(":")
            out[key.strip()] = value.strip()
    return {}  # no closing marker


def validate_skill(text: str, folder_name: str) -> list[str]:
    """Problems that would stop a skill loading or being found. Empty list means it looks valid."""
    meta = parse_frontmatter(text)
    if not meta:
        return ["SKILL.md needs front matter between --- lines with name and description."]
    problems = []
    name, description = meta.get("name", ""), meta.get("description", "")
    if not name:
        problems.append("front matter is missing name")
    else:
        if not NAME_PATTERN.match(name) or len(name) > NAME_MAX:
            problems.append(f"name {name!r} must be lowercase letters, digits and single hyphens, up to {NAME_MAX} characters")
        if name != folder_name:
            problems.append(f"name {name!r} must match the folder name {folder_name!r}")
    if not description:
        problems.append("front matter is missing description")
    elif len(description) > DESCRIPTION_MAX:
        problems.append(f"description is {len(description)} characters, the limit is {DESCRIPTION_MAX}")
    return problems


def check_instructions(text: str) -> list[str]:
    if not text.strip():
        return ["instructions file is empty"]
    if len(text) > INSTRUCTIONS_LIMIT:
        return [f"instructions are {len(text)} characters, the limit is {INSTRUCTIONS_LIMIT}"]
    return []


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def needs_write(source: bytes, existing: bytes | None) -> bool:
    """True when the target is missing or differs. Lets a rerun report 'unchanged' instead of rewriting."""
    return existing is None or digest(source) != digest(existing)


@dataclass(frozen=True)
class Copy:
    source: str  # path relative to the skills folder in the bundle
    target: str  # absolute workspace path


def plan_skill_copies(relative_files: Iterable[str], target_root: str) -> list[Copy]:
    """Map `<skill>/<file>` paths in the bundle to workspace paths. Skips hidden files and caches."""
    plan = []
    for rel in sorted(relative_files):
        parts = rel.split("/")
        if len(parts) < 2 or any(p.startswith(".") or p == "__pycache__" for p in parts):
            continue
        plan.append(Copy(source=rel, target=f"{target_root}/{rel}"))
    return plan


def publish_steps(skill_names: Iterable[str]) -> list[str]:
    """Commands that publish skills to the shared location. Printed, never run by default."""
    names = list(skill_names)
    steps = ["Review the skill in a pull request, then merge it.", "Run these as a user or service principal allowed to write to Workspace/.assistant/skills:"]
    for name in names:
        steps.append(
            f"databricks workspace import-dir guides/genie-code/skills/{name} /Workspace/{SKILLS_DIR}/{name} --overwrite"
        )
    steps.append("Skills with .py or .sql scripts: import-dir can import them as notebooks and strip the extension. Upload those files one at a time with `databricks workspace import --file <f> --format RAW --overwrite <target>`.")
    steps.append("Open a new Genie Code chat and type @ to confirm each skill is listed.")
    return steps
