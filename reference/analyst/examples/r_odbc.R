# R with the odbc package and the Databricks ODBC driver (Simba Spark ODBC driver, installed from the Databricks download page).
# Install: install.packages(c("DBI", "odbc"))
library(DBI)

# OAuth U2M: AuthMech 11 with Auth_Flow 2 opens a browser on first connect.
con <- dbConnect(
  odbc::databricks(),
  httpPath = "/sql/1.0/warehouses/<warehouse-id>",
  workspace = "<workspace-host>"   # no https://
)
# For M2M, set DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET (odbc::databricks() reads them) or
# pass AuthMech = 11, Auth_Flow = 1, Auth_Client_ID, Auth_Client_Secret.

dbGetQuery(con, "SELECT region, COUNT(*) AS customers FROM <catalog>.<schema>.customers GROUP BY region")
dbDisconnect(con)
