# SFTP file retrieval

## Overview

One job connects to an SFTP server with credentials from a Databricks secret scope, copies the files it has not copied before to a Unity Catalog volume, and ingests them with a Lakeflow Declarative Pipeline and Auto Loader. A second fetch right after ingestion finds nothing new. The reference run uses the public read-only server `test.rebex.net`, which is reachable from serverless compute.

## What this shows

| Capability | Artifact |
|---|---|
| Credentials in a secret scope | scope `capability-guides` with keys `sftp-username` and `sftp-password`, created by the `setup_secrets` task |
| Retrieval | `fetch_files` lists the server recursively and copies 17 files (2 text, 15 PNG) to the volume under `sftp/`, keeping the remote folder layout |
| No re-copy | `sftp_transfer_log` keys each file on path, size, and modification time. `refetch_finds_nothing` copies 0 of 17 |
| No reprocessing | Auto Loader tracks files in its checkpoint. `sftp_text_files` has 2 rows and `sftp_binary_files` has 15 rows, one per file |
| Verification | `verify_tables` fails if copied and ingested file counts differ |

## Architecture

```mermaid
flowchart LR
  scope[(secret scope<br/>capability-guides)] --> fetch
  server[SFTP server<br/>test.rebex.net] --> fetch[fetch_files<br/>paramiko]
  log[(sftp_transfer_log)] --> fetch
  fetch --> vol[/Volume: landing/sftp/]
  fetch --> log
  vol --> al[Auto Loader<br/>Lakeflow Declarative Pipeline]
  al --> text[(sftp_text_files)]
  al --> bin[(sftp_binary_files)]
  text --> verify[verify_tables]
  fetch -. second run .-> again[refetch_finds_nothing]
```

## Reference code

- `src/setup_sftp_secrets.py`: creates the scope and writes the two secrets with the SDK
- `src/fetch_sftp_files.py`: connects with paramiko, plans transfers, copies files, writes the log
- `src/source_ingestion/sftp_utils.py`: `walk_remote`, `plan_transfers`, and the `VolumeRemote` stand-in
- `src/pipelines/sftp/*.sql`: the two streaming tables
- `resources/sftp.job.yml` and `resources/sftp.pipeline.yml`
- `tests/test_helpers.py`: tree walk, new-file planning, and file classification

## Demo steps

1. Open the latest run of `capability-guides-sftp` and walk the five tasks in order.
2. Show the secret keys without values: `databricks secrets list-secrets capability-guides`.
3. Compare the two fetch runs:
   ```sql
   SELECT task, mode, remote_files, new_files FROM <catalog>.<schema>.sftp_transfer_runs ORDER BY finished_at;
   ```
4. List the copied files by kind:
   ```sql
   SELECT kind, count(*) FROM <catalog>.<schema>.sftp_transfer_log GROUP BY kind;
   ```
5. Read an ingested text file:
   ```sql
   SELECT source_file, file_size, content FROM <catalog>.<schema>.sftp_text_files;
   ```
6. Run the job again. `fetch_files` copies 0 files and the pipeline update processes 0 new rows.

## Artifacts produced

- Job `capability-guides-sftp` (tag `capability_guide_job: capability_guides_sftp`) and pipeline `capability-guides-sftp`
- Secret scope `capability-guides` (created outside the bundle, see below)
- Tables `sftp_transfer_log`, `sftp_transfer_runs`, `sftp_text_files`, `sftp_binary_files`

## Limitations and next steps

- Secret scopes are not a bundle resource, so the first task creates `capability-guides`. Delete it with `databricks secrets delete-scope capability-guides` when you are done.
- The server publishes its demo credentials. A real server's values go in the same two keys. For key-based auth, store the private key as a third secret.
- The job passes `--allow-volume-fallback`. If outbound SFTP is blocked from serverless, the same copy logic runs against a folder in the volume, and the run records `mode = volume_fallback` plus the connection error in `sftp_transfer_runs`. In the reference run the server was reachable, so `mode = sftp`.
- A file counts as new when path, size, or modification time changes. A server that rewrites files in place with the same size and time is not detected.
- Lakeflow Connect also has an SFTP connector (Public Preview). Use it when you want managed incremental file pulls without writing the copy step.
