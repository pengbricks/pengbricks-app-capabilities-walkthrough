# Databricks notebook source
# MAGIC %md
# MAGIC # R notebook: sparklyr summary
# MAGIC Serverless notebooks and jobs run Python and SQL. They do not run R, so the sql-notebook-analysis job does not include this notebook. It is not a job task.
# MAGIC Attach it to a classic cluster on a Databricks Runtime with R (sparklyr is the supported R interface), then Run All.
# MAGIC Type the `catalog` and `schema` the job used into the two widgets at the top, then Run all. The values are listed in `00_start_here`.
# MAGIC
# MAGIC Required setup: a classic all-purpose cluster on a Runtime with R, in standard or dedicated access mode. On serverless the notebook cannot start, because serverless allows only SQL and Python. The `databricks clusters create` command is in `00_start_here`. Run `01_generate_data` first.

# COMMAND ----------
library(sparklyr)
library(dplyr)

sc <- spark_connect(method = "databricks")
dbutils.widgets.text("catalog", "")
dbutils.widgets.text("schema", "")
catalog <- dbutils.widgets.get("catalog")
schema <- dbutils.widgets.get("schema")

# Precondition: the widgets must be filled and the tables must exist.
if (catalog == "" || schema == "") {
  stop("The catalog and schema widgets are blank. Type the values the job used (see 00_start_here). Nothing was changed.")
}
needed <- c("analyst_orders", "analyst_customers")
present <- sapply(needed, function(t) sparklyr::sdf_sql(sc, paste0("SHOW TABLES IN `", catalog, "`.`", schema, "` LIKE '", t, "'")) %>% sdf_nrow() > 0)
if (!all(present)) {
  stop(paste0("Missing table(s) in ", catalog, ".", schema, ": ", paste(needed[!present], collapse = ", "),
              ". Run: 01_generate_data (or the job capability-guides-sql-notebooks). Nothing was changed."))
}

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
