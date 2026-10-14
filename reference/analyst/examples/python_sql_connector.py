"""Databricks SQL connector from a laptop. Install: pip install databricks-sql-connector databricks-sdk"""

import os

from databricks import sql
from databricks.sdk.core import Config

# User sign-in (OAuth U2M): the first run opens a browser. Run `databricks auth login --host <host>` first.
# Automation (OAuth M2M): set DATABRICKS_HOST, DATABRICKS_CLIENT_ID, and DATABRICKS_CLIENT_SECRET
# for a service principal. The same code works for both.
cfg = Config(host=os.environ["DATABRICKS_HOST"])

with sql.connect(
    server_hostname=cfg.host.replace("https://", ""),
    http_path=f"/sql/1.0/warehouses/{os.environ['DATABRICKS_WAREHOUSE_ID']}",
    credentials_provider=lambda: cfg.authenticate,
) as conn, conn.cursor() as cursor:
    cursor.execute("SELECT region, COUNT(*) FROM <catalog>.<schema>.customers GROUP BY region")
    for row in cursor.fetchall():
        print(row)
