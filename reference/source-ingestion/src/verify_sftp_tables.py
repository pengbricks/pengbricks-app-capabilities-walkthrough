"""Check that the ingested tables match the files copied from SFTP."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    ns = f"{args.catalog}.{args.schema}"

    def n(sql: str) -> int:
        return spark.sql(sql).first()[0]

    logged = {k: n(f"SELECT count(DISTINCT remote_path) FROM {ns}.sftp_transfer_log WHERE kind = '{k}'") for k in ("text", "binary")}
    ingested = {
        "text": n(f"SELECT count(DISTINCT source_file) FROM {ns}.sftp_text_files"),
        "binary": n(f"SELECT count(DISTINCT path) FROM {ns}.sftp_binary_files"),
    }
    total_rows = {"text": n(f"SELECT count(*) FROM {ns}.sftp_text_files"), "binary": n(f"SELECT count(*) FROM {ns}.sftp_binary_files")}
    print(f"copied (distinct files): {logged}; ingested (distinct files): {ingested}; rows: {total_rows}")
    for kind in ("text", "binary"):
        assert logged[kind] > 0, f"no {kind} files were copied"
        assert logged[kind] == ingested[kind] == total_rows[kind], f"{kind}: copied {logged[kind]}, ingested {ingested[kind]}, rows {total_rows[kind]}"
    print("Every copied file was ingested exactly once")


if __name__ == "__main__":
    main()
