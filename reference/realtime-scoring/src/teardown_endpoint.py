"""Delete the scoring endpoint. Safe to rerun: a missing endpoint is not an error."""

from __future__ import annotations

import argparse
import time


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint-name", required=True)
    args = parser.parse_args()

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.errors import NotFound

    w = WorkspaceClient()
    try:
        w.serving_endpoints.delete(args.endpoint_name)
        print(f"Deleted endpoint {args.endpoint_name}")
    except NotFound:
        print(f"Endpoint {args.endpoint_name} does not exist; nothing to delete")
        return

    for _ in range(30):
        names = {endpoint.name for endpoint in w.serving_endpoints.list()}
        if args.endpoint_name not in names:
            print("Confirmed: endpoint no longer listed")
            return
        time.sleep(5)
    raise RuntimeError(f"Endpoint {args.endpoint_name} still listed after delete")


if __name__ == "__main__":
    main()
