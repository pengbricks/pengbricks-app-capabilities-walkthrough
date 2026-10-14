# R with RJDBC and the Databricks JDBC driver (a single jar from the Databricks download page).
# Install: install.packages("RJDBC")
library(RJDBC)

drv <- JDBC("com.databricks.client.jdbc.Driver", "/path/to/DatabricksJDBC.jar")
url <- paste0(
  "jdbc:databricks://<workspace-host>:443/default;",
  "httpPath=/sql/1.0/warehouses/<warehouse-id>;",
  "AuthMech=11;Auth_Flow=2"            # OAuth U2M. M2M: Auth_Flow=1;OAuth2ClientId=...;OAuth2Secret=...
)
con <- dbConnect(drv, url)
dbGetQuery(con, "SELECT COUNT(*) AS orders FROM <catalog>.<schema>.orders")
dbDisconnect(con)
