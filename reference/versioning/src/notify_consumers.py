"""Write one notification row per consumer named in the spec."""

from __future__ import annotations

from versioning_common import contracts_for, fq, load_spec, parse_args


def main() -> None:
    args = parse_args(extra=["release"])
    from databricks.sdk.runtime import spark
    from compatibility import BREAKING, diff_contracts

    spec = load_spec(args.use_case_file)
    dataset = spec["dataset"]["name"]
    owner = spec["dataset"]["owner"]
    contracts = contracts_for(args, spec)
    v11, v2 = contracts["1.1.0"], contracts["2.0.0"]
    sunset = str(v2["sunset_date"])

    breaking = [c for c in diff_contracts(v11, v2) if c.classification == BREAKING]
    renames = {c.column: c.new_column for c in breaking if c.kind == "rename_column"}
    affected = set(renames) | {c.column for c in breaking}

    rows = []
    for consumer in spec["consumers"]:
        impacted = sorted(set(consumer["uses"]) & affected)
        if impacted:
            mapping = ", ".join(f"{c} -> {renames.get(c, c)}" for c in impacted)
            action = f"Move reads from {dataset}_v1 to {dataset}_v2 and update columns ({mapping}) before {sunset}."
        else:
            action = f"No code change needed. Optionally move to {dataset}_v2 before {sunset}."
        message = (f"{dataset} {v2['version']} is released (tag {args.release}). It changes the schema in a breaking way. "
                   f"{dataset}_v1 keeps working as a deprecated view until {sunset}. Owner: {owner}.")
        rows.append((dataset, v2["version"], consumer["name"], ",".join(impacted), message, action, sunset, args.release))

    df = spark.createDataFrame(
        rows, "dataset STRING, contract_version STRING, consumer STRING, impacted_columns STRING, "
              "message STRING, action_required STRING, deadline STRING, release_tag STRING")
    df = df.selectExpr("*", "to_date(deadline) AS deadline_date", "current_timestamp() AS created_at").drop("deadline") \
           .withColumnRenamed("deadline_date", "deadline")
    target = fq(args.catalog, args.schema, "consumer_notifications")
    df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(target)
    spark.table(target).select("consumer", "impacted_columns", "action_required", "deadline").show(truncate=False)


if __name__ == "__main__":
    main()
