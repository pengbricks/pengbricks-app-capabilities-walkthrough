# vscode-starter

A small project for trying the Databricks IDE extension in VS Code (it also runs in Cursor). Open the folder, sign in, and you can run a notebook cell by cell, debug a script, run tests, then deploy and run a Lakeflow job from the editor. Everything runs on serverless compute.

The project holds:

- `src/orders_demo/`: a small Python package that cleans orders and totals revenue per day and category
- `src/notebook.py`: a notebook in Databricks source format that calls the package
- `scratch/explore.py`: a script to debug with Databricks Connect
- `tests/`: pytest tests that run on your machine, plus one optional test that uses Databricks Connect
- `databricks.yml` and `resources/`: a bundle with a `dev` target (the default) and a `prod` target, a schema, and a job with a notebook task and a Python wheel task
- `.vscode/`: settings, launch configurations, and extension recommendations

## Get the project

Clone it from GitHub, or download it as a zip from GitHub or the guide page. Both give you the same files.

```bash
# Option 1: clone, so you can pull updates later
git clone https://github.com/pengbricks/databricks-vscode-starter.git vscode-starter
cd vscode-starter
code .        # or open the folder from VS Code with File > Open Folder

# Pull updates later
git pull

# Option 2: download the zip (on GitHub: Code > Download ZIP), then
unzip databricks-vscode-starter-main.zip
mv databricks-vscode-starter-main vscode-starter && cd vscode-starter
```

To keep your own changes in your own repository, point the clone at it:

```bash
git remote rename origin upstream
git remote add origin https://github.com/<you>/<your-repo>.git
git push -u origin main
```

## What you need

- Visual Studio Code 1.104.0 or later with a Python interpreter available, or Cursor
- The Databricks extension from the Extensions view. Pick the one with Databricks verified ownership.
- The Databricks CLI, tested with v1.17.0 (`databricks --version`). Install it from <https://docs.databricks.com/aws/en/dev-tools/cli/install>.
- [uv](https://docs.astral.sh/uv/). The extension installs it if missing, and the bundle build (`uv build`) needs it.
- A Databricks workspace with Unity Catalog and serverless compute, and a catalog where you can create a schema (`USE CATALOG` and `CREATE SCHEMA`)

## Sign in and create a profile

The CLI, the VS Code extension, and Databricks Connect all read the same profiles from `~/.databrickscfg`. Create one with OAuth; no personal access token is needed.

```bash
databricks --version                                  # v1.17.0 or later
databricks auth login --host https://<your-workspace-url> --profile <name>
                                                      # opens the browser; sign in and approve
databricks auth profiles                              # the new profile shows Valid: YES
databricks current-user me --profile <name>           # confirms who you are signed in as
export DATABRICKS_CONFIG_PROFILE=<name>               # optional: make it the default in this terminal
```

When the sign-in expires (errors about a refresh token or a 401), run the same `databricks auth login --profile <name>` again. In VS Code, pick the same profile under Auth Type in the Configuration view (step 2 below).

## Demo steps

1. **Open the folder.** In VS Code, File > Open Folder and pick `vscode-starter`. Accept the prompt to install the recommended extensions. Click the Databricks icon in the sidebar. The folder has a `databricks.yml`, so the extension treats it as a bundle project.
2. **Sign in with OAuth.** In the Configuration view, click Auth Type, then the gear icon, and choose OAuth (user to machine). Enter your workspace URL, name the profile, and finish the browser sign-in. The profile goes into your Databricks CLI config file, so the CLI and Databricks Connect reuse it. If a profile for your workspace already exists, pick it instead. To pin the workspace in the bundle, add `workspace: host:` under the `dev` target as the comments in `databricks.yml` show.
3. **Pick serverless.** Click Select compute and choose Serverless. Check that the target in the Configuration view is `dev`, and note the mode it shows: development.
4. **Set the catalog.** The bundle needs one value, `catalog`. Set it in the Bundle Variables view, or run `export BUNDLE_VAR_catalog=<catalog>` before you start VS Code from a terminal.
5. **Set up the virtual environment.** In the Configuration view, click Set up Python environment and choose serverless version 5. The extension runs uv, builds `.venv`, and installs a matching `databricks-connect`. This project already pins `databricks-connect==18.0.*` in `pyproject.toml`, the same line the setup resolves for serverless version 5 (it writes `~=18.0.0`). The setup also adds a block of package constraints to `pyproject.toml` and saves a `pyproject.toml.bak`, so diff the two before you commit. Terminal alternative: `uv sync`. When the status bar shows a red Databricks Connect disabled button, click it and follow the prompts until it reads enabled.
6. **Run a notebook cell.** Open `src/notebook.py`. Each cell has Run Cell, Run Above, and Debug Cell. Run the first cell, then the pandas cell, then the Spark cell. The pandas cell runs on your machine and the Spark cell runs on serverless compute. The last cell asserts that both agree.
7. **Debug with a breakpoint.** Open `scratch/explore.py` and click in the gutter beside the line `totals = spark_daily_revenue(...)` to set a breakpoint. Click the Run on Databricks icon beside the editor tabs, then Debug current file with Databricks Connect. At the breakpoint, compare `raw` and `cleaned` in the Variables pane, step into `spark_daily_revenue` with F11, and read the printed result in the Debug Console.
8. **Run the tests.** Open View > Testing. `tests/test_orders.py` runs on your machine with the Run icon. `tests/test_connect.py` needs Databricks Connect, so start it with the Debug icon. The "Unit tests with Databricks Connect" configuration in `.vscode/launch.json` sets `"databricks": true` for that. The Run icon does not use that configuration, so Databricks Connect gets no sign-in from the extension and the test skips.
9. **Deploy from the Bundle Resource Explorer.** Click the cloud icon to deploy the bundle to `dev`. It builds the wheel, uploads the files, and creates the schema and the job `[dev <you>] vscode-starter-orders`. The schema is named `dev_<you>_vscode_starter`.
10. **Run the job.** In the Bundle Resource Explorer, select the job and click the play icon. Expand the job, open Run Status, and click the external-link icon to open the run in the workspace. Two tasks run: the notebook, then the wheel task that writes `daily_revenue`. Query the table:
    ```sql
    SELECT * FROM <catalog>.dev_<you>_vscode_starter.daily_revenue ORDER BY order_date;
    ```
11. **Change code and redeploy.** In `src/orders_demo/orders.py`, change `clean_orders` (for example, drop orders with a unit price over 100), update the test, and run the tests. Click the cloud icon and the play icon again. Deploy uploads only what changed. The new run shows the new behavior.
12. **Deploy to prod.** Switch the target to `prod` with the Target gear and read the host and mode before you click anything. Production mode creates a second, unprefixed copy with a fixed path under your user folder. From a terminal:
    ```bash
    databricks bundle validate --strict -t prod --var catalog=<catalog>
    databricks bundle deploy -t prod --var catalog=<catalog>
    ```
    Real production deploys belong in CI, running as a service principal. Add `run_as` to the `prod` target for that.
13. **Destroy.** Remove what you created, one target at a time. `destroy` deletes the job, the deployed files, and the schema with its tables, and asks you to confirm first.
    ```bash
    databricks bundle destroy --var catalog=<catalog>
    databricks bundle destroy -t prod --var catalog=<catalog>
    ```

## Deploy and run from the terminal

The same steps as the Bundle Resource Explorer, from a terminal in the project folder. Pass `--profile <name>` to each command, or set `DATABRICKS_CONFIG_PROFILE` once. `dev` is the default target.

```bash
# Test locally first
uv sync                                                        # builds .venv with databricks-connect and pytest
uv run pytest                                                  # unit tests; the Connect test skips
DATABRICKS_CONFIG_PROFILE=<name> uv run pytest                 # also runs the Connect test on serverless
DATABRICKS_CONFIG_PROFILE=<name> uv run python scratch/explore.py

# Validate, deploy, and run in dev
databricks bundle validate --strict --var catalog=<catalog>    # catches schema and variable errors
databricks bundle deploy --var catalog=<catalog>               # builds the wheel, uploads files, creates the schema and job
databricks bundle summary --var catalog=<catalog>              # lists what was deployed, with workspace links
databricks bundle run capability_guides_vscode_starter --var catalog=<catalog>
                                                               # runs the job and waits; prints the run URL

# Change code, then redeploy and run again (only changed files upload)
databricks bundle deploy --var catalog=<catalog>
databricks bundle run capability_guides_vscode_starter --var catalog=<catalog>

# Promote the same code to prod (unprefixed names, fixed path under your user folder)
databricks bundle validate --strict -t prod --var catalog=<catalog>
databricks bundle deploy -t prod --var catalog=<catalog>
databricks bundle run capability_guides_vscode_starter -t prod --var catalog=<catalog>

# Clean up: removes the job, the schema and its tables, and the uploaded files
databricks bundle destroy --var catalog=<catalog>
databricks bundle destroy -t prod --var catalog=<catalog>
```

Instead of `--var catalog=<catalog>` on every command, run `export BUNDLE_VAR_catalog=<catalog>` once.

## Troubleshooting

**Databricks Connect does not match the compute.** Symptoms are import errors, unsupported-feature errors, and Spark Connect protocol errors that do not appear in the job. Rebuild the environment with Set up Python environment and choose the compute you run on. Keep the `databricks-connect` pin in `pyproject.toml` on the line that serverless version uses. Serverless version 5 pairs with Databricks Connect 18, and version 6 with 19. Change `environment_version` in `resources/orders.job.yml` when you change the pin. Version table: <https://docs.databricks.com/aws/en/release-notes/serverless/environment-version/>.

**A stale profile.** Errors that mention a refresh token, an invalid token, or a 401 mean the browser sign-in expired. Run `databricks auth login --profile <name>`, or choose the profile again under Auth Type. Check that the host in the Configuration view is the workspace you expect.

**The wrong target.** The Target selector decides which workspace and mode receive a deploy. A deploy to `prod` creates unprefixed resources. Read the host and mode in the Configuration view before you click deploy. Folder sync and the cluster override work only in development mode.

**`dbutils` locally.** In a plain `.py` file, `dbutils` is not defined. Notebooks opened in the extension get it, with a subset of utilities. For `dbutils.widgets`, install `databricks-sdk[notebook]`. Outside a notebook, use `WorkspaceClient().dbutils`, which offers only `fs` and `secrets`. This project avoids the problem: the notebook takes no widgets, and the package never calls `dbutils`.

**`validate` asks for `catalog`.** The variable has no default. Pass `--var catalog=<catalog>`, set `BUNDLE_VAR_catalog`, or set it in the Bundle Variables view.

**`uv build` is not found during deploy.** Install uv (<https://docs.astral.sh/uv/>) and restart VS Code so it sees the new PATH.

**The Connect test shows as skipped.** It skips when Databricks Connect cannot reach serverless compute: no profile, an expired sign-in, or no network. Start it with the Debug icon in the Testing panel, or set `DATABRICKS_CONFIG_PROFILE` in the terminal.

**Windows.** Change the interpreter path in `.vscode/settings.json` to `${workspaceFolder}/.venv/Scripts/python.exe`.

## What is in the folder

| Path | What it is |
|---|---|
| `databricks.yml` | Bundle name, the wheel build, variables, and the `dev` and `prod` targets |
| `resources/orders.job.yml` | The serverless job: notebook task, then wheel task |
| `resources/orders.schema.yml` | The schema the job writes to; `bundle destroy` drops it |
| `src/orders_demo/orders.py` | `clean_orders`, `daily_revenue`, and the Spark version of the total |
| `src/orders_demo/main.py` | The `orders-demo` entry point that the wheel task runs |
| `src/notebook.py` | The notebook, in Databricks source format |
| `scratch/explore.py` | The script to debug; not deployed |
| `tests/` | Unit tests, and the optional Databricks Connect test |
| `pyproject.toml` | Dependencies, the `databricks-connect` pin, pytest and ruff settings |
| `.vscode/` | Interpreter path, pytest discovery, launch configurations, recommended extensions |

## Learn more

| Topic | Documentation |
|---|---|
| The Databricks IDE extension | <https://docs.databricks.com/aws/en/dev-tools/vscode-ext/> |
| Debug code with Databricks Connect | <https://docs.databricks.com/aws/en/dev-tools/vscode-ext/databricks-connect> |
| Run and debug notebook cells | <https://docs.databricks.com/aws/en/dev-tools/vscode-ext/notebooks> |
| Run Python tests | <https://docs.databricks.com/aws/en/dev-tools/vscode-ext/pytest> |
| Bundle and explorer features | <https://docs.databricks.com/aws/en/dev-tools/vscode-ext/bundles> |
| Declarative Automation Bundles | <https://docs.databricks.com/aws/en/dev-tools/bundles> |
| Install Databricks Connect for Python | <https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/install> |
