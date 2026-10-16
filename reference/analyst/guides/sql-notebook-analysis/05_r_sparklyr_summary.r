# Databricks notebook source
# MAGIC %md
# MAGIC # R notebook: sparklyr summary
# MAGIC Serverless notebooks and jobs run Python and SQL. They do not run R, so the sql-notebook-analysis job does not include this notebook. It is not a job task.
# MAGIC Attach it to a classic cluster on a Databricks Runtime with R (sparklyr is the supported R interface), then Run All.
# MAGIC Type the `catalog` and `schema` the job used into the two widgets at the top, then Run all. The values are listed in `00_start_here`.

# COMMAND ----------
library(sparklyr)
library(dplyr)

sc <- spark_connect(method = "databricks")
dbutils.widgets.text("catalog", "")
dbutils.widgets.text("schema", "")
catalog <- dbutils.widgets.get("catalog")
schema <- dbutils.widgets.get("schema")

# COMMAND ----------
# Aggregate in Spark, then collect the small result into a local R data frame.
orders <- tbl(sc, in_catalog(catalog, schema, "analyst_orders"))
customers <- tbl(sc, in_catalog(catalog, schema, "analyst_customers"))

by_region <- orders %>%
  filter(status %in% c("completed", "shipped")) %>%
  inner_join(customers, by = "customer_id") %>%
  group_by(region, segment) %>%
  summarise(orders = n(), revenue = sum(quantity * unit_price, na.rm = TRUE)) %>%
  collect()

print(by_region)

# COMMAND ----------
# Native R statistics on the collected data.
print(summary(by_region$revenue))
print(quantile(by_region$revenue, c(0.25, 0.5, 0.75)))
fit <- lm(revenue ~ orders, data = by_region)
print(summary(fit)$r.squared)

# COMMAND ----------
# Write the result back to Unity Catalog as a Delta table.
spark_write_table(
  copy_to(sc, by_region, "r_by_region_tmp", overwrite = TRUE),
  paste(catalog, schema, "r_revenue_by_region", sep = "."),
  mode = "overwrite"
)
