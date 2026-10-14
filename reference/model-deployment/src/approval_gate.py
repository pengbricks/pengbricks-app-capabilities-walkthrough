"""Promote @challenger to @champion only when an approval exists.

Approval sources, checked in order:
  1. the `approved_by` job parameter (CI passes the GitHub actor after the environment approval)
  2. a row in the `model_approvals` table for this model version with status 'approved'
No approval: print why, mark promoted=false, and finish successfully.
"""

import argparse
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--model-version", required=True)
p.add_argument("--approved-by", default="")
p.add_argument("--champion-alias", default="champion")
p.add_argument("--challenger-alias", default="challenger")
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
from databricks.sdk.runtime import dbutils, spark
from mlflow.tracking import MlflowClient

import common


def table_approver(table: str, model: str, version: str) -> str:
    if not spark.catalog.tableExists(table):
        return ""
    rows = spark.sql(
        f"SELECT approved_by FROM {table} WHERE model_name = '{model}' "
        f"AND model_version = '{version}' AND status = 'approved' "
        f"ORDER BY approved_at DESC LIMIT 1"
    ).collect()
    return rows[0]["approved_by"] if rows else ""


def main() -> None:
    spec = common.load_spec(args.spec)
    model_name = common.full_model_name(args.catalog, args.schema, spec)
    mlflow.set_registry_uri("databricks-uc")
    client = MlflowClient(registry_uri="databricks-uc")

    challenger = client.get_model_version_by_alias(model_name, args.challenger_alias)
    if str(challenger.version) != str(args.model_version):
        raise SystemExit(f"@{args.challenger_alias} is version {challenger.version}, expected {args.model_version}")

    approver = args.approved_by.strip() or table_approver(
        f"{args.catalog}.{args.schema}.model_approvals", model_name, args.model_version
    )
    if not approver:
        print(
            f"No approval for version {args.model_version}. Stopping at the gate: "
            f"@{args.challenger_alias} stays, @{args.champion_alias} is unchanged. "
            "Re-run with --params approved_by=<name> or add an 'approved' row to model_approvals."
        )
        dbutils.jobs.taskValues.set(key="promoted", value="false")
        return

    client.set_registered_model_alias(model_name, args.champion_alias, args.model_version)
    client.set_model_version_tag(model_name, args.model_version, "approved_by", approver)
    dbutils.jobs.taskValues.set(key="promoted", value="true")
    print(f"{approver} approved version {args.model_version}: @{args.champion_alias} now points to it")


main()
