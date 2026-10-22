# Databricks notebook source
# MAGIC %md
# MAGIC # 3. Install the example skill and instructions
# MAGIC
# MAGIC Copies `skills/gc-sample-data/` from this bundle into **your own** Genie Code skills folder, `/Users/<you>/.assistant/skills/`, and can copy `instructions.md` to your user instructions file. Genie Code loads a skill when a request matches its description, and you can invoke it by typing `@` and its name. Start a new chat after installing, because changes do not reach open chats.
# MAGIC
# MAGIC By default the notebook writes only inside your home folder. Writing to the shared workspace location is off unless you set `write_workspace_wide` to `yes`. The notebook then prints the steps to publish the skills to the shared folder, so a reviewer can run them.
# MAGIC
# MAGIC Safe to rerun: each file is compared with what is already there and rewritten in place only when it differs. Nothing is deleted. This is a standalone notebook, not a task in the job, because it changes your own Genie Code settings and not the guide's tables.
# MAGIC
# MAGIC ## Required setup
# MAGIC
# MAGIC | Need | Where |
# MAGIC |---|---|
# MAGIC | Write access to your home folder | You have it by default |
# MAGIC | `install_instructions = yes` | Replaces your `.assistant_instructions.md`. Copy your current file first if you want to keep it. Limit is 20,000 characters |
# MAGIC | `write_workspace_wide = yes` | Needs permission to write to the workspace-level `.assistant/skills` folder. The docs say workspace admins create workspace skills and can grant others access to that folder. Workspace instructions can be edited only by workspace admins, so this notebook never writes them |
# MAGIC | The bundle files | Deploy the bundle, or open the notebook from the synced bundle folder, so `skills/` sits next to this notebook |

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from pathlib import Path
from analyst_common import genie_skills as gs

dbutils.widgets.dropdown("write_workspace_wide", "no", ["no", "yes"], "Also write to the shared workspace folder")
dbutils.widgets.dropdown("install_instructions", "no", ["no", "yes"], "Replace my user instructions file")
write_shared = dbutils.widgets.get("write_workspace_wide") == "yes"
install_instructions = dbutils.widgets.get("install_instructions") == "yes"

here = Path(os.getcwd())
skills_src = here / "skills"
instructions_src = here / "instructions.md"
assert skills_src.is_dir(), f"Expected {skills_src}. Run this notebook from the deployed bundle folder."

# COMMAND ----------

# MAGIC %md
# MAGIC ## Validate the skills before copying
# MAGIC
# MAGIC The front matter needs `name` (matching the folder) and `description`. A skill that fails here is not copied.

# COMMAND ----------

skill_names = sorted(p.name for p in skills_src.iterdir() if p.is_dir())
bad = {}
for name in skill_names:
    problems = gs.validate_skill((skills_src / name / gs.SKILL_FILE).read_text(), name)
    if problems:
        bad[name] = problems
    print(f"{name}: {'ok' if not problems else problems}")
assert not bad, f"Fix these skills first: {bad}"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Copy to your skills folder (overwrite in place)

# COMMAND ----------

import io
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.workspace import ImportFormat

w = WorkspaceClient()
me = w.current_user.me().user_name


def read_existing(path):
    try:
        return w.workspace.download(path).read()
    except Exception:
        return None


def install(root):
    files = [str(p.relative_to(skills_src)) for p in skills_src.rglob("*") if p.is_file()]
    for step in gs.plan_skill_copies(files, root):
        data = (skills_src / step.source).read_bytes()
        if not gs.needs_write(data, read_existing(step.target)):
            print(f"unchanged  {step.target}")
            continue
        w.workspace.mkdirs(step.target.rsplit("/", 1)[0])
        w.workspace.upload(step.target, io.BytesIO(data), format=ImportFormat.RAW, overwrite=True)
        print(f"written    {step.target}")


install(gs.skills_root("user", me))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Optional: your user instructions file
# MAGIC
# MAGIC Off by default. When on, `instructions.md` replaces `/Users/<you>/.assistant_instructions.md`.

# COMMAND ----------

if install_instructions:
    text = instructions_src.read_text()
    problems = gs.check_instructions(text)
    assert not problems, problems
    target = gs.user_instructions_path(me)
    data = text.encode()
    if gs.needs_write(data, read_existing(target)):
        w.workspace.upload(target, io.BytesIO(data), format=ImportFormat.RAW, overwrite=True)
        print(f"written    {target}")
    else:
        print(f"unchanged  {target}")
else:
    print("Skipped. Set install_instructions to yes to copy instructions.md to your user instructions file.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Optional: the shared workspace folder
# MAGIC
# MAGIC Skills in `/Workspace/.assistant/skills/` are visible to everyone in the workspace. Publish them through a reviewed pull request and CI, not from a personal run. This cell writes there only when `write_workspace_wide` is `yes`, and it stops with a clear message if you lack permission.

# COMMAND ----------

if write_shared:
    try:
        install(gs.workspace_skills_root())
    except Exception as e:
        print(f"Could not write to {gs.workspace_skills_root()}: {e}\nAsk a workspace admin for access to that folder, or use the steps below.")
else:
    print("Skipped the shared folder (write_workspace_wide = no).")

print("\nTo publish to the shared folder from CI or a terminal:")
for step in gs.publish_steps(skill_names):
    print(" -", step)
print(f"\nWorkspace instructions live at {gs.workspace_instructions_path()}. Only workspace admins can edit that file.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Try it
# MAGIC
# MAGIC Open a new Genie Code chat and type `@gc-sample-data`, then: "Which region had the highest revenue last quarter? Write no tables." Check that the answer uses the revenue statuses and a `gc_` table.
