#!/usr/bin/env bash
# Storage credentials and workspace-catalog bindings for layout (a). Not executed by this repo: set the
# variables below, then run each section as a metastore admin (or the catalog owner for the bindings).
# Order: section 1 here (credentials), then 01_catalogs.sql, then sections 2 to 5 here, then 03_grants.sql.
set -euo pipefail

PROFILE="${PROFILE:?databricks CLI profile of a metastore admin}"
ACCOUNT_ID="${ACCOUNT_ID:?cloud account that holds the per-environment roles}"
# Numeric workspace IDs: the number in each workspace URL (?o=...) or `databricks workspace get-status`.
DEV_WS="${DEV_WS:?}"; TEST_WS="${TEST_WS:?}"; STAGE_WS="${STAGE_WS:?}"; PROD_WS="${PROD_WS:?}"

# 1. One storage credential per environment, each on its own cloud role (AWS shown; Azure and GCP use
#    azure_managed_identity and databricks_gcp_service_account in the same JSON slot).
for env in dev test stage prod; do
  databricks storage-credentials create "${env}_storage" --profile "$PROFILE" \
    --json "{\"aws_iam_role\": {\"role_arn\": \"arn:aws:iam::${ACCOUNT_ID}:role/${env}-unity-storage\"}}"
done

# 2. Isolate each catalog, then bind it to its own workspace. OPEN is the default; a binding is only
#    consulted once the catalog is ISOLATED.
bind() {  # catalog workspace-id [binding-type]
  databricks catalogs update "$1" --isolation-mode ISOLATED --profile "$PROFILE"
  databricks workspace-bindings update-bindings catalog "$1" --profile "$PROFILE" \
    --json "{\"add\": [{\"workspace_id\": $2, \"binding_type\": \"${3:-BINDING_TYPE_READ_WRITE}\"}]}"
}
bind dev   "$DEV_WS"
bind test  "$TEST_WS"
bind stage "$STAGE_WS"
bind prod  "$PROD_WS"

# 3. Optional: bind prod into stage read-only, for parity checks. Stage can read prod and cannot write to it.
databricks workspace-bindings update-bindings catalog prod --profile "$PROFILE" \
  --json "{\"add\": [{\"workspace_id\": ${STAGE_WS}, \"binding_type\": \"BINDING_TYPE_READ_ONLY\"}]}"

# 4. Check the result. Each catalog should list only its own workspace (prod also lists stage, read-only).
for c in dev test stage prod; do
  echo "== $c"; databricks workspace-bindings get-bindings catalog "$c" --profile "$PROFILE"
done

# 5. Storage credentials and external locations take bindings too, so a dev workspace cannot use the prod
#    role or read the prod bucket. Their isolation flag uses a different value than catalogs do.
databricks storage-credentials update prod_storage --isolation-mode ISOLATION_MODE_ISOLATED --profile "$PROFILE"
databricks workspace-bindings update-bindings storage_credential prod_storage --profile "$PROFILE" \
  --json "{\"add\": [{\"workspace_id\": ${PROD_WS}, \"binding_type\": \"BINDING_TYPE_READ_WRITE\"}]}"
databricks external-locations update prod_managed --isolation-mode ISOLATION_MODE_ISOLATED --profile "$PROFILE"
databricks workspace-bindings update-bindings external_location prod_managed --profile "$PROFILE" \
  --json "{\"add\": [{\"workspace_id\": ${PROD_WS}, \"binding_type\": \"BINDING_TYPE_READ_WRITE\"}]}"
