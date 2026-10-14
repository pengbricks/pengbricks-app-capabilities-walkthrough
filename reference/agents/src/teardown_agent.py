"""Delete the agent's Model Serving endpoint and the gateway model services with their inference tables.

Keeps the registered model versions, the sample data, and every record table.
"""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--endpoint-name", default="")
p.add_argument("--delete-gateway-services", default="true")
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import agents_common as ac
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.runtime import spark


def main() -> None:
    spec = ac.load_spec(args.spec)
    w = WorkspaceClient()
    name = args.endpoint_name or spec["build"]["endpoint_name"]
    try:
        w.serving_endpoints.delete(name)
        print(f"deleted serving endpoint {name}")
    except NotFound:
        print(f"serving endpoint {name} not found; nothing to delete")
    try:
        w.serving_endpoints.get(name)
        raise SystemExit(f"endpoint {name} still exists")
    except NotFound:
        print(f"confirmed: {name} is gone")

    if ac.to_bool(args.delete_gateway_services):
        for svc in spec["gateway"]["services"]:
            fq = ac.qualified(args.catalog, args.schema, svc["name"])
            try:
                w.ai_gateway.delete_model_service(name=f"model-services/{fq}")
                print(f"deleted model service {fq}")
            except NotFound:
                print(f"model service {fq} not found")
            spark.sql(f"DROP TABLE IF EXISTS {fq}_payload")


main()
