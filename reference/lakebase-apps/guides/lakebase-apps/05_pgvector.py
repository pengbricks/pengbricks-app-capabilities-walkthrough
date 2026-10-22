# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 5. pgvector
# MAGIC
# MAGIC Safe to rerun. Postgres extensions install with `CREATE EXTENSION`. The `vector` extension (pgvector) is available on Postgres 16, 17, and 18, with `ivfflat` and `hnsw` indexes. This notebook installs it, stores five small embeddings, builds an hnsw index, and finds the nearest neighbours of a query vector with cosine distance.
# MAGIC
# MAGIC The embeddings are four numbers each, written by hand so the result is easy to check. A real app stores the output of an embedding model, and the column size must match the model. The table sits in its own schema (`lakebase_vectors`) so the Change Data Feed on the app schema does not pick it up.
# MAGIC
# MAGIC Every statement repeats safely: `IF NOT EXISTS` on the extension, table, and index, and an upsert for the rows.
# MAGIC
# MAGIC For large embedding sets, Lakebase Search adds `lakebase_vector`, which uses the same types and operators.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import load_params
from databricks.sdk import WorkspaceClient
import lakebase_lib as lb

params = load_params(dbutils, "capability_guides_lakebase_apps", ['lakebase_project'])
w = WorkspaceClient()
user = w.current_user.me().user_name
VECTOR_SCHEMA = "lakebase_vectors"
pool = lb.make_pool(w, lb.endpoint_name(params["lakebase_project"], lb.BRANCH, lb.ENDPOINT), user)
lb.connect_with_retry(pool)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Install the extension, create the table and index, load the rows

# COMMAND ----------

with pool.connection() as conn:
    for statement in lb.vector_schema_sql(VECTOR_SCHEMA):
        conn.execute(statement)
    with conn.cursor() as cur:
        cur.executemany(lb.upsert_docs_sql(VECTOR_SCHEMA), [(i, body, lb.vector_literal(vec)) for i, body, vec in lb.SAMPLE_DOCS])
    version = conn.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector'").fetchone()[0]
    indexes = conn.execute("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = %s AND tablename = 'docs'", (VECTOR_SCHEMA,)).fetchall()
print(f"pgvector {version}; {len(lb.SAMPLE_DOCS)} documents")
for name, definition in indexes:
    print(" ", definition)
assert any("hnsw" in d for _, d in indexes), "the hnsw index is missing"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Nearest neighbours
# MAGIC
# MAGIC The query vector sits close to the two billing documents. `<=>` is cosine distance, so smaller is closer.

# COMMAND ----------

query = [0.15, 0.85, 0.05, 0.05]
literal = lb.vector_literal(query)
with pool.connection() as conn:
    nearest = conn.execute(lb.nearest_sql(VECTOR_SCHEMA, limit=3), (literal, literal)).fetchall()
display(spark.createDataFrame([(r[0], r[1], float(r[2])) for r in nearest], "id INT, body STRING, cosine_distance DOUBLE"))
assert {r[0] for r in nearest[:2]} == {2, 5}, "the billing documents should rank first"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Check that the planner can use the index
# MAGIC
# MAGIC With five rows the planner prefers a sequential scan, so this turns that off for one transaction. `SET LOCAL` ends with the transaction, so nothing changes for other sessions.

# COMMAND ----------

with pool.connection() as conn:
    with conn.transaction():
        conn.execute("SET LOCAL enable_seqscan = off")
        plan = conn.execute(f"EXPLAIN SELECT id FROM {VECTOR_SCHEMA}.docs ORDER BY embedding <=> %s::vector LIMIT 3", (literal,)).fetchall()
print("\n".join(line[0] for line in plan))
pool.close()
