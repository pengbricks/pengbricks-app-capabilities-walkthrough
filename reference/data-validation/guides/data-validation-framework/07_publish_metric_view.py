# Databricks notebook source
# MAGIC %md
# MAGIC # 7. Publish the metric view
# MAGIC
# MAGIC Safe to rerun: it stops with a message if the silver table or this run's check results are missing. The metric view is replaced, the certification tag is set rather than added, and each job run adds one row to `dv_metric_view_checks`, a history table. Creates `dv_orders_metrics`, a Unity Catalog metric view on the validated orders, with `net_revenue` and `order_count` defined once. The job runs this task only when validation did not block, so the published definition sits on data that passed its error-severity checks. The notebook then queries the metric with `MEASURE()` and checks the answer against a direct query on the table.
# MAGIC
# MAGIC It also tries to mark the view as certified with the `system.certification_status` tag. That needs the ASSIGN permission on the governed tag, so the notebook reports the outcome instead of failing.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_data_validation", ['catalog', 'schema', 'use_case', 'run_id'], defaults={'run_id': 'manual'})
catalog, schema = params["catalog"], params["schema"]
ns = f"{catalog}.{schema}"
run_id = params["run_id"]
SPEC_FILE = bundle_root() / "use_cases" / f"{params['use_case']}.yml"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create the metric view

# COMMAND ----------

import yaml
import dv_lib
dv_lib.require_ready(spark, ns, "publish_metric_view", run_id)
spec = dv_lib.load_spec(SPEC_FILE)
mv = spec["metric_view"]
view = f"{ns}.{dv_lib.ident(mv['name'])}"
definition = {"version": str(mv["definition"]["version"]), "source": f"{ns}.{dv_lib.ident(mv['source'])}",
              **{k: v for k, v in mv["definition"].items() if k != "version"}}
body = yaml.safe_dump(definition, sort_keys=False, width=1000)
spark.sql(f"CREATE OR REPLACE VIEW {view} WITH METRICS LANGUAGE YAML AS $$\n{body}$$")
print(f"Created metric view {view}")
print(body)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Query a measure and check it against the table
# MAGIC
# MAGIC The measure answer must equal the same aggregate written directly in SQL on the silver table.

# COMMAND ----------

from decimal import Decimal

by_day = spark.sql(f"SELECT order_date, MEASURE(net_revenue) AS net_revenue, MEASURE(order_count) AS order_count FROM {view} GROUP BY ALL ORDER BY order_date DESC LIMIT 5")
display(by_day)
from_view = spark.sql(f"SELECT MEASURE(net_revenue) AS v, MEASURE(order_count) AS n FROM {view}").first()
from_table = spark.sql(f"SELECT sum(amount) FILTER (WHERE status <> 'cancelled') AS v, count(*) AS n FROM {ns}.{mv['source']}").first()
match = Decimal(str(from_view.v)) == Decimal(str(from_table.v)) and from_view.n == from_table.n
print(f"net_revenue: metric view {from_view.v}, table {from_table.v}; order_count: metric view {from_view.n}, table {from_table.n}")

ddl = "run_id STRING, checked_at TIMESTAMP, metric_view STRING, net_revenue_from_view DECIMAL(18,2), net_revenue_from_table DECIMAL(18,2), order_count BIGINT, matches BOOLEAN, certified STRING"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Certify the view
# MAGIC
# MAGIC Certification is a signal on top of the definition. Genie and the catalog use it to steer people toward trusted assets.

# COMMAND ----------

try:
    spark.sql(f"SET TAG ON VIEW {view} `system.certification_status` = `certified`")
    certified = "certified"
except Exception as exc:
    certified = "not set: " + str(exc).splitlines()[0][:160]
print(f"Certification: {certified}")

from datetime import datetime, timezone
spark.sql(f"CREATE TABLE IF NOT EXISTS {ns}.dv_metric_view_checks ({ddl})")
spark.sql(f"DELETE FROM {ns}.dv_metric_view_checks WHERE run_id = '{run_id}'")
spark.createDataFrame(
    [(run_id, datetime.now(timezone.utc), view, Decimal(str(from_view.v)).quantize(Decimal("0.01")), Decimal(str(from_table.v)).quantize(Decimal("0.01")), int(from_view.n), bool(match), certified)], ddl
).write.mode("append").saveAsTable(f"{ns}.dv_metric_view_checks")
if not match:
    raise SystemExit("The metric view and the table disagree")
