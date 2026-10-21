# Databricks notebook source
# MAGIC %md
# MAGIC # 5. Read lineage and governance
# MAGIC
# MAGIC Reads what Unity Catalog records about the two metric views: their type, owner, and grants, the source tables lineage lists upstream, and the certification tag. It also sets `system.certification_status = certified` on both views when the running identity may assign it, and records what happens when it may not.
# MAGIC
# MAGIC Lineage is written shortly after a query, so the lineage check retries for a few minutes before it gives up. Nothing is granted or revoked. Safe to rerun: the step replaces its own rows in `mv_results`.

# COMMAND ----------

import sys, os, time
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
params = load_params(dbutils, "capability_guides_metric_views", ['catalog', 'schema', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]

import mv_lib as m
T = {key: m.fq(catalog, schema, name) for key, name in m.TABLES.items()}
V = {key: m.fq(catalog, schema, name) for key, name in m.VIEWS.items()}
rows = []
EXPECTED_SOURCES = {
    "orders": {"mv_orders", "mv_customers", "mv_products"},
    "funnel": {"mv_sessions", "mv_customers"},
}

# COMMAND ----------

# MAGIC %md
# MAGIC ## Type, owner, and definition

# COMMAND ----------

import json

for key, view in V.items():
    detail = json.loads(spark.sql(f"DESCRIBE TABLE EXTENDED {view} AS JSON").first()[0])
    rows.append({"check": f"{m.VIEWS[key]}: object type", "grain": "unity catalog", "view": None, "hand": None, "passed": detail.get("type") is not None,
                 "detail": f"type={detail.get('type')}, owner={detail.get('owner')}, columns={len(detail.get('columns', []))}, has definition text={bool(detail.get('view_text'))}"})
    print(m.VIEWS[key], detail.get("type"), detail.get("owner"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Grants
# MAGIC
# MAGIC A metric view uses the same privileges as any view. Consumers need `SELECT` on the metric view, plus `USE CATALOG` and `USE SCHEMA` above it.

# COMMAND ----------

for key, view in V.items():
    try:
        grants = [r.asDict() for r in spark.sql(f"SHOW GRANTS ON TABLE {view}").collect()]
        detail = ", ".join(sorted({f"{g['Principal']}:{g['ActionType']}" for g in grants})) or "none beyond the owner"
        rows.append({"check": f"{m.VIEWS[key]}: grants", "grain": "unity catalog", "view": len(grants), "hand": None, "passed": True, "detail": detail})
    except Exception as exc:  # noqa: BLE001 - record what the identity could not read
        rows.append({"check": f"{m.VIEWS[key]}: grants", "grain": "unity catalog", "view": None, "hand": None, "passed": False, "detail": f"could not read grants: {type(exc).__name__}"})

# COMMAND ----------

# MAGIC %md
# MAGIC ## Certification tag
# MAGIC
# MAGIC `system.certification_status` is a system tag that tells consumers which assets are approved. Setting it needs `ASSIGN` on the tag. If the identity lacks it, the result records the error and the job continues.

# COMMAND ----------

for key, view in V.items():
    name = m.VIEWS[key]
    try:
        spark.sql(f"ALTER VIEW {view} SET TAGS ('system.certification_status' = 'certified')")
        tags = spark.sql(f"""SELECT tag_name, tag_value FROM `{catalog}`.information_schema.table_tags
                             WHERE schema_name = '{schema}' AND table_name = '{name}'""").collect()
        found = {t.tag_name: t.tag_value for t in tags}
        rows.append({"check": f"{name}: certification tag", "grain": "unity catalog", "view": None, "hand": None,
                     "passed": found.get("system.certification_status") == "certified", "detail": f"tags read back: {found}"})
    except Exception as exc:  # noqa: BLE001
        rows.append({"check": f"{name}: certification tag", "grain": "unity catalog", "view": None, "hand": None, "passed": False,
                     "detail": f"could not set the tag: {type(exc).__name__}: {str(exc).splitlines()[0][:160]}"})

# COMMAND ----------

# MAGIC %md
# MAGIC ## Lineage
# MAGIC
# MAGIC The lineage API lists the tables a metric view reads from (upstream) and what reads from it (downstream). The check passes when every source table named in the YAML shows up upstream.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()

def upstream_names(view_fq):
    full = view_fq.replace("`", "")
    resp = w.api_client.do("GET", "/api/2.0/lineage-tracking/table-lineage", query={"table_name": full, "include_entity_lineage": True})
    return {u["tableInfo"]["name"] for u in resp.get("upstreams", []) if "tableInfo" in u}, resp

for key, view in V.items():
    expected = EXPECTED_SOURCES[key]
    found, resp = set(), {}
    for attempt in range(10):
        try:
            found, resp = upstream_names(view)
        except Exception as exc:  # noqa: BLE001
            print(f"lineage call failed ({type(exc).__name__}); retrying")
        if expected <= found:
            break
        time.sleep(30)
    rows.append({"check": f"{m.VIEWS[key]}: lineage upstream tables", "grain": "lineage api", "view": len(found & expected), "hand": len(expected),
                 "matched": len(found & expected), "checked": len(expected), "passed": expected <= found,
                 "detail": f"upstream found: {sorted(found)}"})
    print(m.VIEWS[key], "upstream:", sorted(found))

# COMMAND ----------

m.write_results(spark, T["results"], "governance", rows, params["run_id"])
display(spark.table(T["results"]).where("step = 'governance'").orderBy("check_name"))
