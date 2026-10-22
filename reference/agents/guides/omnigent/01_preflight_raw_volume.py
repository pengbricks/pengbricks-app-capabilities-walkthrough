# Databricks notebook source
# MAGIC %md
# MAGIC # 1. Preflight: land raw data in a volume
# MAGIC
# MAGIC Creates the Unity Catalog volume `omnigent_raw` in the shared schema if it is missing, then writes three kinds of raw files with a fixed seed: `orders.csv`, `customers.json`, and an `events/` folder of JSON files. The paths are fixed, so a rerun overwrites the same files and lands the same bytes.
# MAGIC
# MAGIC The orders file holds two planted defects, a repeated `order_id` and a missing `amount`, so the silver step Omnigent builds has something to clean.
# MAGIC
# MAGIC Safe to rerun: the volume is created only when missing, and each file is overwritten in place. Event files from an earlier run with a different file count are removed.
# MAGIC
# MAGIC Required setup: `CREATE VOLUME` on the shared schema, and serverless compute. See `00_start_here`.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params

params = load_params(
    dbutils,
    "capability_guides_omnigent",
    ["catalog", "schema", "volume", "seed"],
    defaults={"volume": "omnigent_raw", "seed": "42"},
)

# COMMAND ----------

import omnigent_lib as ol

# COMMAND ----------

# MAGIC %md
# MAGIC ## Run it

# COMMAND ----------

def main() -> dict:
    catalog, schema, volume = params["catalog"], params["schema"], params["volume"]
    seed = int(params["seed"])
    paths = ol.raw_paths(catalog, schema, volume)

    spark.sql(
        f"CREATE VOLUME IF NOT EXISTS `{catalog}`.`{schema}`.`{volume}` "
        "COMMENT 'Raw files for the Omnigent guide. Safe to delete.'"
    )

    customers = ol.generate_customers(seed)
    orders = ol.generate_orders(seed, customers)
    events = ol.generate_events(seed, orders)

    os.makedirs(paths["events_dir"], exist_ok=True)
    with open(paths["orders"], "w") as handle:
        handle.write(ol.orders_to_csv(orders))
    with open(paths["customers"], "w") as handle:
        handle.write(ol.to_json_lines(customers))
    for path, batch in zip(paths["events"], events):
        with open(path, "w") as handle:
            handle.write(ol.to_json_lines(batch))
    # Drop event files this guide wrote on an earlier run that are no longer part of the set.
    for name in os.listdir(paths["events_dir"]):
        full = f"{paths['events_dir']}/{name}"
        if name.startswith("events_") and name.endswith(".json") and full not in paths["events"]:
            os.remove(full)

    print(f"Volume: {catalog}.{schema}.{volume}")
    print(f"orders.csv      {paths['orders']}  ({len(orders)} rows)")
    print(f"customers.json  {paths['customers']}  ({len(customers)} rows)")
    for path, batch in zip(paths["events"], events):
        print(f"events file     {path}  ({len(batch)} rows)")
    print("Table prefix: omni_   Pipeline name prefix: omnigent_")
    return paths


paths = main()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Prompts for Omnigent
# MAGIC
# MAGIC The prompts from `prompts.md` with this run's catalog and schema filled in. Paste them into Omnigent in order.

# COMMAND ----------

from pathlib import Path

prompts_file = bundle_root() / "guides" / "omnigent" / "prompts.md"
if prompts_file.exists():
    print(ol.render_prompts(prompts_file.read_text(), params["catalog"], params["schema"], params["volume"]))
else:
    print("prompts.md was not found next to this notebook.")
