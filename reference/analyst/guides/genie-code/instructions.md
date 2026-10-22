# Team rules for Genie Code

These rules apply to every request. Keep them short. Put task-specific knowledge in a skill.

## Data

- Use Unity Catalog three-level names (`catalog.schema.table`). Never guess a table. Ask when the request does not name one.
- Treat tables prefixed `gc_` as sample data. Do not write to a table without that prefix unless the request names it.
- Prefer serverless compute and a serverless SQL warehouse.

## Code

- Read the plan before running. Say what the code will write before it writes.
- Add an assert that ties each result to a source count or total.
- Use SQL for set logic and Python for charts and checks.
- No hard-coded credentials, tokens or workspace URLs.

## Style

- Name notebooks, flows and dashboards with a clear prefix, such as `gc_`.
- Add a comment on every table and column you create.
- Show the row count after every write.
