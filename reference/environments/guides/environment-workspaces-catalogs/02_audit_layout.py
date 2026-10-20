# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Audit the layout
# MAGIC
# MAGIC Reads what Unity Catalog says about the catalog and this environment's schema, then reports whether the layout holds up:
# MAGIC
# MAGIC - the catalog's isolation mode (`ISOLATED` or `OPEN`) and its workspace bindings, read-only or read-write
# MAGIC - the catalog's owner (a person, a service principal, or a group) and whether it has its own managed location
# MAGIC - which environment schemas exist, and whether a dev schema is a personal sandbox
# MAGIC - the schema's owner, its `environment` tag, and the grants on it (in prod, a person who owns or can write to the schema is a warn)
# MAGIC
# MAGIC The notebook only reads. Findings go to `environment_layout_audit` in the environment schema; each run replaces the table. A warn never fails the task: the audit reports, it does not enforce.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_environments", ['catalog', 'schema', 'environment'])

# COMMAND ----------

from layout_lib import Facts, build_findings
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import DatabricksError

catalog, schema, environment = params["catalog"], params["schema"], params["environment"]
w = WorkspaceClient()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Gather the facts

# COMMAND ----------

def value(enum):
    return enum.value if enum is not None else None


info = w.catalogs.get(catalog)
try:
    bindings = [(b.workspace_id, value(b.binding_type) or "BINDING_TYPE_READ_WRITE") for b in w.workspace_bindings.get_bindings("catalog", catalog)]
except DatabricksError as error:
    print(f"Could not read bindings: {error}")
    bindings = None

try:
    grants = {a.principal: [value(p) for p in a.privileges or []] for a in w.grants.get("schema", f"{catalog}.{schema}").privilege_assignments or []}
except DatabricksError as error:
    print(f"Could not read grants: {error}")
    grants = None

schema_names = [r.schema_name for r in spark.sql(f"SELECT schema_name FROM `{catalog}`.information_schema.schemata").collect()]
tags = spark.sql(
    f"SELECT tag_value FROM `{catalog}`.information_schema.schema_tags WHERE schema_name = '{schema}' AND tag_name = 'environment'"
).collect()

facts = Facts(
    environment=environment,
    catalog=catalog,
    schema=schema,
    schema_names=schema_names,
    user_name=w.current_user.me().user_name,
    isolation_mode=value(info.isolation_mode),
    owner=info.owner,
    has_managed_location=bool(info.storage_root),
    bindings=bindings,
    workspace_id=w.get_workspace_id(),
    schema_tag=tags[0].tag_value if tags else None,
    schema_grants=grants,
    schema_owner=w.schemas.get(f"{catalog}.{schema}").owner,
)
print(f"{catalog}: isolation {facts.isolation_mode}, {len(schema_names)} schemas, bindings {bindings}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Judge the layout and record the findings

# COMMAND ----------

findings = build_findings(facts)
rows = [(f.check, f.status, f.finding, f.detail) for f in findings]
table = f"`{catalog}`.`{schema}`.environment_layout_audit"

(
    spark.createDataFrame(rows, "check string, status string, finding string, detail string")
    .selectExpr("*", f"'{environment}' AS environment", f"'{catalog}' AS catalog", "current_timestamp() AS checked_at")
    .write.mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(table)
)

for f in findings:
    print(f"[{f.status.upper():<4}] {f.check:<13}{f.finding}")
counts = {s: sum(f.status == s for f in findings) for s in ("pass", "warn", "info")}
print(f"\n{counts['pass']} pass, {counts['warn']} warn, {counts['info']} info -> {catalog}.{schema}.environment_layout_audit")
