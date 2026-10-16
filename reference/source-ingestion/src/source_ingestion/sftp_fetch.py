"""Copy new files from an SFTP server to a volume and record each transfer.

Credentials come from a secret scope. A file counts as new when its (path, size, mtime) is not in
`sftp_transfer_log`, so reruns copy nothing that was already copied. If the server is unreachable
and `allow_volume_fallback` is set, the same logic runs against a directory in the volume and the
run records mode `volume_fallback` with the connection error.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from source_ingestion.sftp_utils import VolumeRemote, classify, local_path, plan_transfers, walk_remote


def fetch_new_files(spark, dbutils, cfg: dict, catalog: str, schema: str, run_id: str, task: str, allow_volume_fallback: bool = False) -> list:
    """Copy files not yet in sftp_transfer_log; return the log rows of the files copied."""
    ns = f"{catalog}.{schema}"
    volume = f"/Volumes/{catalog}/{schema}/source_landing"
    target = f"{volume}/sftp"
    spark.sql(
        f"CREATE TABLE IF NOT EXISTS {ns}.sftp_transfer_log (run_id STRING, transferred_at TIMESTAMP, remote_path STRING, "
        "size BIGINT, mtime BIGINT, kind STRING, volume_path STRING, mode STRING)"
    )
    spark.sql(
        f"CREATE TABLE IF NOT EXISTS {ns}.sftp_transfer_runs (run_id STRING, task STRING, finished_at TIMESTAMP, mode STRING, "
        "host STRING, remote_files INT, new_files INT, error STRING)"
    )

    username = dbutils.secrets.get(cfg["secret_scope"], "sftp-username")
    password = dbutils.secrets.get(cfg["secret_scope"], "sftp-password")

    mode, error, transport, remote = "sftp", None, None, None
    try:
        import paramiko

        transport = paramiko.Transport((cfg["host"], int(cfg["port"])))
        transport.banner_timeout = cfg["connect_timeout_seconds"]
        transport.connect(username=username, password=password)
        remote = paramiko.SFTPClient.from_transport(transport)
        remote.get_channel().settimeout(cfg["connect_timeout_seconds"])
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        if not allow_volume_fallback:
            raise
        mode = "volume_fallback"
        source_dir = f"{volume}/sftp_source"
        if not os.path.isdir(source_dir):
            os.makedirs(f"{source_dir}/pub", exist_ok=True)
            for name, body in {"readme.txt": "sample file", "pub/notes.txt": "second sample file"}.items():
                with open(f"{source_dir}/{name}", "w") as handle:
                    handle.write(body)
        remote = VolumeRemote(source_dir)
        print(f"SFTP unreachable ({error}); using volume fallback {source_dir}")

    seen = {
        (r.remote_path, r.size, r.mtime)
        for r in spark.sql(f"SELECT remote_path, size, mtime FROM {ns}.sftp_transfer_log").collect()
    }
    listing = [f for root in cfg["remote_roots"] for f in walk_remote(remote, root)]
    todo = plan_transfers(listing, seen)

    now = datetime.now(timezone.utc)
    copied = []
    for f in todo:
        destination = local_path(target, f.path)
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        remote.get(f.path, destination)
        if os.path.getsize(destination) != f.size:
            raise RuntimeError(f"size mismatch after copying {f.path}")
        copied.append((run_id, now, f.path, f.size, f.mtime, classify(f.path, cfg["text_suffixes"], cfg["binary_suffixes"]), destination, mode))
    if copied:
        spark.createDataFrame(
            copied,
            "run_id string, transferred_at timestamp, remote_path string, size bigint, mtime bigint, kind string, volume_path string, mode string",
        ).write.mode("append").saveAsTable(f"{ns}.sftp_transfer_log")
    spark.createDataFrame(
        [(run_id, task, datetime.now(timezone.utc), mode, cfg["host"], len(listing), len(copied), error)],
        "run_id string, task string, finished_at timestamp, mode string, host string, remote_files int, new_files int, error string",
    ).write.mode("append").saveAsTable(f"{ns}.sftp_transfer_runs")

    if transport is not None:
        transport.close()
    print(f"mode={mode} remote_files={len(listing)} new_files={len(copied)}")
    return copied
