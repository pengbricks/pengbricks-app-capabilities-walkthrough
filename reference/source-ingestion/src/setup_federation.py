"""Create (or refresh) the Unity Catalog connection that exposes Lakebase Postgres, plus a foreign catalog if allowed.

The connection stores a Lakebase OAuth token as its password. Tokens last about an hour, so every
run replaces the token. A production setup uses a Lakeflow Connect managed connector or a
long-lived credential from a secret store instead.
"""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src-dir", required=True)
    parser.add_argument("--use-case-file", required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.src_dir)

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.errors import NotFound
    from databricks.sdk.runtime import spark
    from databricks.sdk.service.catalog import ConnectionType
    from source_ingestion import lakebase
    from source_ingestion.spec import load_spec

    cfg = load_spec(args.use_case_file)["relational"]
    w = WorkspaceClient()
    s = lakebase.connection_settings(w, cfg["lakebase_project"], cfg["lakebase_branch"], cfg["lakebase_endpoint"], cfg["lakebase_database"])
    options = {"host": s["host"], "port": str(s["port"]), "user": s["user"], "password": s["password"]}

    name = cfg["connection_name"]
    try:
        w.connections.get(name)
        w.connections.update(name=name, options=options)
        print(f"Updated connection {name} with a fresh token")
    except NotFound:
        w.connections.create(name=name, connection_type=ConnectionType.POSTGRESQL, options=options, comment="Lakebase Postgres source for the capability guides")
        print(f"Created connection {name}")

    # A foreign catalog needs CREATE CATALOG on the metastore. Without it the connection still works
    # through remote_query, which is what the extract task uses.
    catalog = cfg["foreign_catalog"]
    try:
        spark.sql(f"CREATE FOREIGN CATALOG IF NOT EXISTS `{catalog}` USING CONNECTION `{name}` OPTIONS (database '{cfg['lakebase_database']}')")
        print(f"Foreign catalog {catalog} is available")
    except Exception as exc:
        print(f"Foreign catalog {catalog} not created: {str(exc).splitlines()[0][:200]}")
    inner = f"SELECT table_name FROM information_schema.tables WHERE table_schema = \\'{cfg['source_schema']}\\'"
    probe = spark.sql(
        f"SELECT count(*) AS n FROM remote_query('{name}', database => '{cfg['lakebase_database']}', query => '{inner}')"
    ).first()["n"]
    print(f"remote_query sees {probe} tables in schema {cfg['source_schema']}")


if __name__ == "__main__":
    main()
