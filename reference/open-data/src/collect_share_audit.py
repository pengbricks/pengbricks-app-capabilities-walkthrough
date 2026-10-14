"""Copy the Unity Catalog audit events for the share and recipient into a table.

system.access.audit lags the event by several minutes, so the task polls until the
closing event shows up or the wait budget runs out.
"""

from __future__ import annotations

import argparse
import time

from open_data.spec import load_spec

EVENT_SQL = """
SELECT event_time, service_name, action_name,
       user_identity.email AS actor,
       response.status_code AS status_code,
       coalesce(request_params['name'], request_params['name_arg'], request_params['share'],
                request_params['recipient_name'], request_params['name_arg']) AS object_name,
       request_params['securable_type'] AS securable_type,
       request_params['privilege'] AS privilege,
       request_params['changes'] AS changes
FROM system.access.audit
WHERE event_time >= timestamp_seconds({started})
  AND service_name IN ('unityCatalog', 'deltaSharing')
  AND (to_json(request_params) LIKE '%{share}%' OR to_json(request_params) LIKE '%{recipient}%')
ORDER BY event_time
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--use-case-file", required=True)
    parser.add_argument("--started-epoch", required=True, type=int)
    parser.add_argument("--final-action", required=True, help="Audit action that marks the end of the run")
    args = parser.parse_args()

    from databricks.sdk.runtime import spark

    cfg = load_spec(args.use_case_file)["sharing"]
    query = EVENT_SQL.format(started=args.started_epoch - 60, share=cfg["share_name"], recipient=cfg["recipient_name"])
    deadline = time.time() + int(cfg["audit_wait_seconds"])
    while True:
        events = spark.sql(query)
        actions = {r["action_name"] for r in events.select("action_name").distinct().collect()}
        if args.final_action in actions or time.time() > deadline:
            break
        print(f"{events.count()} events so far, waiting for {args.final_action}")
        time.sleep(30)

    target = f"{args.catalog}.{args.schema}.sharing_audit_events"
    events.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
    summary = spark.sql(f"SELECT action_name, count(*) AS n FROM {target} GROUP BY action_name ORDER BY action_name").collect()
    print(f"{target}: " + ", ".join(f"{r['action_name']}={r['n']}" for r in summary))


if __name__ == "__main__":
    main()
