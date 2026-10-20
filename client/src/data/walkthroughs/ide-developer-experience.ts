import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'ide-developer-experience',
  area: 'CI/CD & Version Control Guides',
  title: 'Developer workflow in the IDE',
  intro:
    'The fast loop is: edit in your IDE, run the code on serverless compute through Databricks Connect, test plain functions with pytest, package shared code as a wheel, and run the same tests in CI before a bundle deploys. This page covers each step, what to keep in a notebook versus a package, and the checks to automate.',
  shortVersion: [
    {
      title: 'Run against serverless with Databricks Connect.',
      body: 'Your IDE runs the Python and the DataFrame work executes on Databricks. There is no cluster to start or keep warm, and breakpoints work in your own debugger.',
    },
    {
      title: 'Write plain functions, then test them with pytest.',
      body: 'Put logic in functions that take and return DataFrames or plain values. Pure-Python rules need no Spark. Spark tests share one Databricks Connect session.',
    },
    {
      title: 'Package shared code as a wheel.',
      body: 'The default-python bundle template gives you a src package, a pyproject.toml, a tests folder, and a job that installs the wheel. Notebooks import the package instead of copying code.',
    },
    {
      title: 'Use Git folders for notebooks, the IDE for packages.',
      body: 'Git folders put the same repository in the workspace for exploration and review. Notebook edits and IDE edits go through the same branches and pull requests.',
    },
    {
      title: 'Lint locally, test again in CI.',
      body: 'Ruff and pre-commit catch style and import problems before a commit. CI repeats the lint and pytest, then runs bundle validate and deploy.',
    },
  ],
  sections: [
    {
      id: 'loop',
      heading: 'The inner loop',
      prose:
        'Each step feeds the next, and the same checks run again on every pull request. Local edits stay cheap because Databricks Connect sends only the query plan to the workspace.',
      diagram: {
        type: 'flow',
        title: 'From edit to deployed job',
        description:
          'An engineer edits code in the IDE and runs it on serverless compute through Databricks Connect. pytest tests the same code. A Git push triggers CI, which runs lint, pytest, and bundle validate. A merge deploys the bundle, which creates the Lakeflow Job.',
        nodes: [
          { id: 'ide', label: 'Edit in the IDE', sub: 'VS Code, Cursor, PyCharm', col: 0, row: 0 },
          { id: 'dbc', label: 'Databricks Connect', sub: 'executes on serverless', col: 1, row: 0, kind: 'highlight' },
          { id: 'test', label: 'pytest', sub: 'plain and Spark tests', mono: true, col: 2, row: 0 },
          { id: 'git', label: 'Git push', sub: 'branch and pull request', col: 3, row: 0 },
          { id: 'ci', label: 'CI', sub: 'lint, pytest, validate', col: 3, row: 1, kind: 'gate' },
          { id: 'deploy', label: 'Bundle deploy', sub: 'dev, then test, then prod', col: 2, row: 1 },
          { id: 'job', label: 'Lakeflow Job', sub: 'installs the wheel', col: 1, row: 1, kind: 'store' },
          { id: 'gf', label: 'Git folder', sub: 'notebooks in workspace', col: 0, row: 1, kind: 'surface' },
        ],
        edges: [
          { from: 'ide', to: 'dbc' },
          { from: 'dbc', to: 'test' },
          { from: 'test', to: 'git' },
          { from: 'git', to: 'ci' },
          { from: 'ci', to: 'deploy', label: 'merge' },
          { from: 'deploy', to: 'job' },
          { from: 'job', to: 'gf', dashed: true, label: 'imports' },
        ],
        legend: [
          { kind: 'highlight', label: 'Local code, remote execution' },
          { kind: 'gate', label: 'Blocks the merge' },
          { kind: 'surface', label: 'Workspace copy of the repo' },
        ],
      },
    },
    {
      id: 'connect',
      heading: 'Databricks Connect against serverless',
      prose:
        'Databricks Connect is a thin client. Your code runs in your local Python process, while DataFrame and SQL operations run on Databricks compute. Point it at serverless and a session starts in seconds.',
      points: [
        {
          strong: 'Install and authenticate once.',
          text: 'Install a databricks-connect version that matches the compute you target, and authenticate with a CLI profile that uses OAuth. The Databricks extension for VS Code and Cursor has a checklist that sets this up.',
        },
        {
          strong: 'Create the session in one place.',
          text: 'Build the session in a helper or a pytest fixture, not in every function. The same function then runs unchanged in a job, where a session already exists.',
        },
        {
          strong: 'Know the limits.',
          text: 'Libraries that reach the Spark JVM or RDDs do not work over Spark Connect. On serverless, Python UDFs cannot ship custom libraries. Keep that code behind a thin wrapper you can skip locally.',
        },
        {
          strong: 'Debug in your own tools.',
          text: 'Set breakpoints in the IDE and step through a failing test. Inspect a DataFrame at the breakpoint with show or toPandas on a sample.',
        },
      ],
      examples: [
        {
          label: 'One session helper for scripts and tests',
          language: 'python',
          code: `from databricks.connect import DatabricksSession
from pyspark.sql import SparkSession


def get_spark() -> SparkSession:
    # Inside a job or notebook, getActiveSession returns the existing session.
    # Locally, Databricks Connect starts one on serverless compute.
    return SparkSession.getActiveSession() or DatabricksSession.builder.serverless().getOrCreate()`,
          notes: ['Authentication comes from your Databricks CLI profile or environment variables, never from the code.'],
        },
      ],
      links: [
        {
          label: 'Databricks Connect for Python',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python',
          note: 'Install, configure, and limits.',
        },
        {
          label: 'Databricks extension for VS Code',
          url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext',
          note: 'Run, debug, and deploy bundles from the editor.',
        },
      ],
    },
    {
      id: 'tests',
      heading: 'Test plain functions with pytest',
      prose:
        'Notebook-only code can only be tested by running the notebook. A function in a module can be tested in milliseconds. Split logic along that line.',
      points: [
        {
          strong: 'Pure-Python rules first.',
          text: 'Row-level rules, parsing, and naming logic need no Spark. Test them with ordinary pytest and run them on every save.',
        },
        {
          strong: 'DataFrame functions take a DataFrame in and return one.',
          text: 'Build a tiny input DataFrame in the test, call the function, and compare collected rows. Name the edge case in the test, such as keys that differ only in case or whitespace.',
        },
        {
          strong: 'Share one Spark session across the suite.',
          text: 'Create it in a session-scoped fixture so the suite pays the connection cost once.',
        },
        {
          strong: 'Test SQL too.',
          text: 'Run assertion queries after a transform, for example row counts, null keys, and duplicate keys. A failed assertion fails the task.',
        },
      ],
      examples: [
        {
          label: 'A session fixture and an edge-case test',
          language: 'python',
          code: `# tests/conftest.py
import pytest
from my_pkg.session import get_spark


@pytest.fixture(scope="session")
def spark():
    return get_spark()


# tests/test_transforms.py
from my_pkg.transforms import clean_records


def test_keys_that_differ_only_in_case_and_space_collapse(spark):
    df = spark.createDataFrame([("a-1 ", 1), ("A-1", 2)], "key string, value int")
    assert clean_records(df, key="key").count() == 1`,
          notes: ['The fixture is the only place that knows about Databricks Connect.'],
        },
      ],
      links: [
        {
          label: 'Unit testing for notebooks',
          url: 'https://docs.databricks.com/aws/en/notebooks/testing',
          note: 'How to organize functions and tests.',
        },
        {
          label: 'Databricks Connect testing',
          url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/testing',
          note: 'pytest with Databricks Connect.',
        },
      ],
    },
    {
      id: 'packaging',
      heading: 'Package shared code as a wheel',
      prose:
        'Copying a helper into three notebooks means three places to fix. A wheel gives the code one version, one test suite, and one install path in every environment.',
      points: [
        {
          strong: 'Start from the template.',
          text: 'databricks bundle init default-python creates a src package, pyproject.toml, tests, a resources folder for jobs and pipelines, and databricks.yml with dev and prod targets. Build on it instead of hand-rolling the layout.',
        },
        {
          strong: 'Declare the build in pyproject.toml.',
          text: 'List runtime dependencies there, and put pytest and ruff in a dev group. The bundle builds the wheel on deploy and tasks reference it as a library.',
        },
        {
          strong: 'Keep notebooks thin.',
          text: 'A notebook should parse parameters, call package functions, and show results. Anything you would test belongs in the package.',
        },
        {
          strong: 'Pin versions per target.',
          text: 'Deploy to dev with development mode, which prefixes resource names per user. Promote the same wheel to test and prod rather than rebuilding it.',
        },
      ],
      examples: [
        {
          label: 'pyproject.toml for a bundle package',
          language: 'toml',
          code: `[project]
name = "my_pkg"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = ["pyyaml"]

[dependency-groups]
dev = ["pytest", "ruff", "databricks-connect"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 110

[tool.ruff.lint]
select = ["E", "F", "I"]`,
          notes: ['Pin the databricks-connect version to the compute you target in development.'],
        },
      ],
      links: [
        {
          label: 'Bundle project templates',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/templates',
          note: 'The default-python template.',
        },
        {
          label: 'Python wheel dependencies in bundles',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/library-dependencies',
          note: 'Build and install a wheel on a job task.',
        },
      ],
    },
    {
      id: 'git-ci',
      heading: 'Git folders, lint, and the same tests in CI',
      prose:
        'Local checks are for speed. CI is the check that cannot be skipped, so it should run the same commands.',
      steps: [
        {
          title: 'Use Git folders for the workspace copy',
          body: 'Clone the repository into a Git folder to run notebooks, review a teammate branch, or explore data. Commit and push from the Git folder or the IDE. Use a service principal and a production Git folder only if you deploy code without bundles.',
        },
        {
          title: 'Lint and format before every commit',
          body: 'Run ruff check and ruff format in a pre-commit hook. It keeps reviews about logic instead of style and catches unused imports before they reach CI.',
          code: `repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format`,
        },
        {
          title: 'Run the same commands in CI',
          body: 'On each pull request run ruff, pytest, and databricks bundle validate. Authenticate with OAuth workload identity federation instead of a stored token. After merge, deploy to dev and then promote.',
          code: `ruff check . && ruff format --check .
pytest tests
databricks bundle validate --target dev`,
        },
        {
          title: 'Run the tests on serverless too',
          body: 'Add a first task to the job that runs pytest on serverless compute and fails on any failure. Downstream tasks then never run on code that does not pass its tests.',
        },
      ],
      links: [
        {
          label: 'Git folders',
          url: 'https://docs.databricks.com/aws/en/repos',
          note: 'Clone, branch, and commit in the workspace.',
        },
        {
          label: 'CI/CD with Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/ci-cd',
          note: 'Which branches and folders to use per stage.',
        },
        {
          label: 'GitHub Actions with Databricks',
          url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github',
          note: 'Workload identity federation for CI.',
        },
      ],
    },
  ],
  related: [
    { slug: 'dab-starter', title: 'Running a Declarative Automation Bundle' },
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
  ],
};
