# SAS and SPSS

Both tools connect through the same ODBC or JDBC driver as every other client. Permissions come from the identity that signs in, so the tool sees exactly the tables Unity Catalog grants that identity.

## SAS (SAS/ACCESS Interface to ODBC)

```sas
libname dbx odbc noprompt="DSN=Databricks;" schema=<schema>;
proc sql;
  select region, count(*) as customers from dbx.analyst_customers group by region;
quit;
```

Use the `[Databricks]` data source from `odbc.ini.example`. SAS/ACCESS to JDBC takes the URL in `jdbc_url.txt`.

## SPSS (Statistics, Database Wizard)

1. File > Open Database > New Query.
2. Add ODBC Data Source, then choose the `Databricks` DSN. For JDBC, use the Databricks JDBC jar and the URL in `jdbc_url.txt`.
3. Pick the table, select fields, and run the query.
