"""Roll a table back to an earlier Delta version. Defaults to the version before the latest write."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", required=True)
    parser.add_argument("--version", default="")
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    history = spark.sql(f"DESCRIBE HISTORY {args.table}").select("version", "operation").orderBy("version", ascending=False).collect()
    if len(history) < 2 and not args.version:
        raise RuntimeError(f"{args.table} has no earlier version to restore")
    # Default to the version just before the latest write (history is newest first).
    target = int(args.version) if args.version else history[1].version
    print(f"Restoring {args.table} from version {history[0].version} to version {target}")
    spark.sql(f"RESTORE TABLE {args.table} TO VERSION AS OF {target}").show(truncate=False)


if __name__ == "__main__":
    main()
