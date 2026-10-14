"""Call an external process: a shell command from Python and an HTTP request to a public endpoint.

The first attempt fails on purpose (when --fail-first-attempt=true) so the task retry policy is
visible in the run: attempt 0 fails, attempt 1 succeeds. A marker row per job run tells the
second attempt it is a retry.
"""

from __future__ import annotations

import argparse
import subprocess
import time
import urllib.request


def http_get(url: str, timeout: int = 20) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "capability-guides"})
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed https URL from the spec
        return response.status, response.read(200).decode("utf-8", "replace").strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--fail-first-attempt", default="true")
    args = parser.parse_args()

    import guide_lib as g
    from databricks.sdk.runtime import dbutils, spark

    prefix = f"{args.catalog}.{args.schema}"
    spark.sql(f"CREATE TABLE IF NOT EXISTS {prefix}.orch_attempt_marker (job_run_id STRING, marked_at TIMESTAMP)")
    seen = spark.sql(f"SELECT COUNT(*) FROM {prefix}.orch_attempt_marker WHERE job_run_id = '{args.run_id}'").first()[0]
    if args.fail_first_attempt.lower() == "true" and seen == 0:
        spark.sql(f"INSERT INTO {prefix}.orch_attempt_marker VALUES ('{args.run_id}', current_timestamp())")
        raise RuntimeError("Simulated transient failure on the first attempt; the retry policy runs this task again.")

    url = g.load_spec(args.use_case_file)["orchestration"]["http_probe_url"]
    shell = subprocess.run(["python3", "--version"], capture_output=True, text=True, check=True)
    shell_out = (shell.stdout or shell.stderr).strip()

    started = time.time()
    status, body = http_get(url)
    elapsed_ms = int((time.time() - started) * 1000)

    spark.sql(
        f"""
        CREATE TABLE IF NOT EXISTS {prefix}.orch_external_calls
        (job_run_id STRING, kind STRING, target STRING, result STRING, elapsed_ms BIGINT, called_at TIMESTAMP)
        """
    )
    rows = [
        (args.run_id, "shell", "python3 --version", shell_out, 0),
        (args.run_id, "http", url, f"HTTP {status}: {body[:120]}", elapsed_ms),
    ]
    df = spark.createDataFrame(rows, "job_run_id STRING, kind STRING, target STRING, result STRING, elapsed_ms BIGINT")
    df.selectExpr("*", "current_timestamp() AS called_at").write.mode("append").saveAsTable(f"{prefix}.orch_external_calls")
    dbutils.jobs.taskValues.set(key="http_status", value=status)
    print(f"external: shell -> {shell_out}; http {status} in {elapsed_ms} ms")


if __name__ == "__main__":
    main()
