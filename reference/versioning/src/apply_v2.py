"""Publish contract v2.0.0 (breaking) as a new table and keep v1 consumers working through a view."""

from __future__ import annotations

from versioning_common import contracts_for, delta_version, fq, load_spec, parse_args, register, set_tags


def main() -> None:
    args = parse_args(extra=["release"])
    from databricks.sdk.runtime import spark
    from compatibility import assert_compatible, compat_view_select, create_table_sql, migrate_select

    spec = load_spec(args.use_case_file)
    dataset = spec["dataset"]["name"]
    contracts = contracts_for(args, spec)
    v11, v2 = contracts["1.1.0"], contracts["2.0.0"]
    sunset = str(v2["sunset_date"])

    # Same gate the earlier task ran; refuse to publish if the bump is wrong.
    assert_compatible(v11, v2)

    name = lambda suffix: fq(args.catalog, args.schema, f"{dataset}_{suffix}")  # noqa: E731
    v1_name, archive, v2_table = name("v1"), name("v1_archive"), name("v2")

    # 1. Move the old physical table aside so the name customers_v1 can become a view.
    spark.sql(f"ALTER TABLE {v1_name} RENAME TO {archive}")
    archive_version = delta_version(spark, archive)

    # 2. Publish the breaking shape as a new table.
    spark.sql(create_table_sql(v2, v2_table))
    spark.sql(f"INSERT INTO {v2_table} SELECT {', '.join(migrate_select(v11, v2))} FROM {archive}")
    register(spark, args.catalog, args.schema, dataset=dataset, version="2.0.0", change_type="breaking",
             object_name=f"{dataset}_v2", release=args.release, delta_ver=delta_version(spark, v2_table))
    set_tags(spark, v2_table, {"contract_version": "2.0.0", "deprecated": "false"})

    # 3. Compatibility view: the v1.1.0 shape over the v2 data.
    migrate_msg = (f"DEPRECATED, removed after {sunset}. Migrate to {dataset}_v2: "
                   "full_name -> display_name, lifetime_value (bigint dollars) -> lifetime_value_usd (decimal(18,2)).")
    spark.sql(f"CREATE VIEW {v1_name} COMMENT '{migrate_msg}' AS "
              f"SELECT {', '.join(compat_view_select(v11, v2))} FROM {v2_table}")
    deprecated_tags = {"contract_version": "1.1.0", "deprecated": "true", "sunset_date": sunset}
    set_tags(spark, v1_name, deprecated_tags, view=True)
    register(spark, args.catalog, args.schema, dataset=dataset, version="2.0.0", change_type="compatibility_view",
             object_name=f"{dataset}_v1", release=args.release, delta_ver=None)

    # 4. The archived v1 table is deprecated too, with the same pointer.
    spark.sql(f"COMMENT ON TABLE {archive} IS '{migrate_msg} Archived physical v1.1.0 data.'")
    set_tags(spark, archive, deprecated_tags)
    register(spark, args.catalog, args.schema, dataset=dataset, version="1.1.0", change_type="deprecated",
             object_name=f"{dataset}_v1_archive", release=args.release, delta_ver=archive_version)

    print(f"v2.0.0 published as {dataset}_v2; {dataset}_v1 is now a deprecated compatibility view (sunset {sunset}).")
    spark.sql(f"SELECT * FROM {v1_name} LIMIT 5").show(truncate=False)
    spark.sql(f"SELECT * FROM {v2_table} LIMIT 5").show(truncate=False)


if __name__ == "__main__":
    main()
