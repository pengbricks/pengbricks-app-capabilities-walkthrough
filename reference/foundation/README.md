# Foundation

Owns the shared `capability_guides` schema that every guide bundle writes to, and grants the app service principal `USE_SCHEMA`.

Deploy it once per workspace before any other bundle:

```bash
cd reference/foundation
databricks bundle deploy --target dev --profile <profile> \
  --var catalog=<catalog> --var app_service_principal=<app-service-principal-application-id>
```

In development mode the schema is named `dev_<user>_capability_guides`; the other bundles' `dev` targets point at the same name. The `test` target uses `test_capability_guides`.
