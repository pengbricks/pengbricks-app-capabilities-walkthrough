"""Create the secret scope and store the SFTP credentials. Safe to run repeatedly."""

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
    from databricks.sdk.errors import ResourceAlreadyExists
    from source_ingestion.spec import load_spec

    cfg = load_spec(args.use_case_file)["sftp"]
    w = WorkspaceClient()
    try:
        w.secrets.create_scope(scope=cfg["secret_scope"])
        print(f"Created secret scope {cfg['secret_scope']}")
    except ResourceAlreadyExists:
        print(f"Secret scope {cfg['secret_scope']} already exists")
    # The reference server publishes these credentials. A real server's values go in the same keys.
    w.secrets.put_secret(scope=cfg["secret_scope"], key="sftp-username", string_value=cfg["username"])
    w.secrets.put_secret(scope=cfg["secret_scope"], key="sftp-password", string_value=cfg["password"])
    keys = sorted(s.key for s in w.secrets.list_secrets(scope=cfg["secret_scope"]))
    print(f"Keys in scope: {keys}")


if __name__ == "__main__":
    main()
