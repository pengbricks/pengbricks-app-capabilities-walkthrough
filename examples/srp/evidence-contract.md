# Evidence Contract

A run artifact is verified only when the repository can link an immutable release to an actual Databricks execution.

Required fields:

- Guide and demo slug.
- Environment and owner.
- Git commit SHA and immutable permalink.
- Bundle target and deployment identifier.
- Resource type and resource ID.
- Job run, task run, and pipeline update IDs where applicable.
- Start time, end time, and terminal status.
- Databricks run and pipeline update URLs.
- Monitoring query or exported result URI.
- Output artifact URI and recorded timestamp.

`Located` means a portable example exists. It does not mean deployed or verified. `Verified` requires the fields above plus captured acceptance outputs.
