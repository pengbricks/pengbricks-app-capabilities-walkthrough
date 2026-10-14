"""Generate the sample input table from the use case spec. Uses dbldatagen with a
fixed seed; falls back to seeded Spark SQL expressions if dbldatagen is unavailable."""


def generate(spark, spec):
    sd = spec["sample_data"]
    try:
        return _with_dbldatagen(spark, sd), "dbldatagen"
    except Exception as e:  # fallback keeps the guide runnable
        print(f"dbldatagen unavailable or failed ({str(e)[:150]}); using seeded Spark SQL fallback")
        return _with_sql(spark, sd), "spark_sql_fallback"


def _with_dbldatagen(spark, sd):
    import dbldatagen as dg

    gen = dg.DataGenerator(spark, name="legacy_conversion_orders", rows=sd["rows"],
                           partitions=sd.get("partitions", 1), randomSeedMethod="hash_fieldname",
                           randomSeed=sd["seed"])
    for c in sd["columns"]:
        kwargs = {}
        if "expr" in c:
            kwargs["expr"] = c["expr"]
        if "range" in c:
            kwargs.update(minValue=c["range"]["min"], maxValue=c["range"]["max"], random=True, step=0.01)
        if c.get("omit"):
            kwargs["omit"] = True
        gen = gen.withColumn(c["name"], c["type"], **kwargs)
    return gen.build()


def _with_sql(spark, sd):
    exprs = ["id"]
    for c in sd["columns"]:
        if "range" in c:
            r = c["range"]
            e = f"cast(round({r['min']} + rand({sd['seed']}) * ({r['max']} - {r['min']}), 2) as {c['type']})"
        else:
            e = f"cast({c['expr']} as {c['type']})"
        exprs.append(f"{e} as {c['name']}")
    # Evaluate in layers so later expressions can use earlier columns.
    df = spark.range(sd["rows"])
    for c, e in zip(sd["columns"], exprs[1:]):
        df = df.selectExpr("*", e)
    keep = [c["name"] for c in sd["columns"] if not c.get("omit")]
    return df.select(*keep)
