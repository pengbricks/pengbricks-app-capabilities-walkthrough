"""Publish a starter bundle from reference/ to its public GitHub repository as a single commit.

    python scripts/publish_starter_repo.py                  # dry run: show what would change
    python scripts/publish_starter_repo.py --push           # amend the one commit and force-push it
    python scripts/publish_starter_repo.py vscode-databricks --push

The guide's `download` entry in server/artifacts.json names the repository (`repo`, `branch`), the
folder to publish (`path`), and files to leave out (`exclude`). The published files are the same ones
a zip download would hold (build_artifact_snippets.download_files). The repository keeps one commit,
so readers see the current starter without the review history; each publish amends it and pushes with
--force-with-lease against the commit it cloned.

Pushes go through gh as the git credential helper, as the `--gh-user` account (default pengbricks).
The script switches gh to that account for the push and switches back to the previous one after.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_artifact_snippets as builder  # noqa: E402

CREDENTIALS = ["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential"]
DEFAULT_MESSAGE = {"vscode-databricks": "Databricks VS Code starter bundle"}


def run(*args: str, cwd: Path | None = None) -> str:
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def active_gh_user() -> str | None:
    try:
        return run("gh", "api", "user", "--jq", ".login")
    except subprocess.CalledProcessError:
        return None


def switch_gh_user(user: str) -> None:
    run("gh", "auth", "switch", "--hostname", "github.com", "--user", user)


def publish(slug: str, push: bool, gh_user: str, message: str | None) -> int:
    guide = json.loads(builder.INDEX.read_text(encoding="utf-8"))["guides"][slug]
    config = guide.get("download") or {}
    if not config.get("repo"):
        print(f"{slug} has no download.repo in server/artifacts.json; nothing to publish.")
        return 1
    repo, branch = config["repo"], config.get("branch", "main")
    url = f"https://github.com/{repo}.git"
    source = builder.ROOT / config["path"]
    files = builder.download_files(config)

    previous = active_gh_user()
    if previous != gh_user:
        switch_gh_user(gh_user)
    try:
        with tempfile.TemporaryDirectory(prefix="publish-starter-") as tmp:
            work = Path(tmp) / "repo"
            run("git", *CREDENTIALS, "clone", "--quiet", "--branch", branch, url, str(work))
            cloned = run("git", "rev-parse", "HEAD", cwd=work)
            for entry in work.iterdir():
                if entry.name != ".git":
                    shutil.rmtree(entry) if entry.is_dir() else entry.unlink()
            for path in files:
                target = work / path
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source / path, target)
            run("git", "add", "--all", cwd=work)
            changes = run("git", "status", "--short", cwd=work)
            if not changes:
                print(f"{repo} already matches {config['path']} ({cloned[:7]}).")
                return 0
            print(f"Changes to {repo} from {config['path']}:\n{changes}")
            if not push:
                print("\nDry run. Rerun with --push to amend the commit and force-push it.")
                return 0
            commits = int(run("git", "rev-list", "--count", "HEAD", cwd=work))
            text = message or run("git", "log", "-1", "--format=%B", cwd=work) or DEFAULT_MESSAGE.get(slug, slug)
            if commits != 1:
                # Collapse any history into one commit so the repository keeps a single commit.
                run("git", "checkout", "--quiet", "--orphan", "publish", cwd=work)
                run("git", "commit", "--quiet", "--message", text, cwd=work)
                run("git", "branch", "--move", "--force", branch, cwd=work)
            else:
                run("git", "commit", "--quiet", "--amend", "--message", text, cwd=work)
            run("git", *CREDENTIALS, "push", f"--force-with-lease={branch}:{cloned}", "origin", f"{branch}:{branch}", cwd=work)
            print(f"\nPushed {repo} {branch}: {cloned[:7]} -> {run('git', 'rev-parse', '--short', 'HEAD', cwd=work)}")
            return 0
    finally:
        if previous and previous != gh_user:
            switch_gh_user(previous)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("slug", nargs="?", default="vscode-databricks", help="guide slug in server/artifacts.json")
    parser.add_argument("--push", action="store_true", help="amend the commit and force-push it")
    parser.add_argument("--gh-user", default="pengbricks", help="gh account that can push to the repository")
    parser.add_argument("--message", help="commit message; defaults to the current one")
    args = parser.parse_args()
    return publish(args.slug, args.push, args.gh_user, args.message)


if __name__ == "__main__":
    raise SystemExit(main())
