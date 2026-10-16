# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Run the release tests
# MAGIC
# MAGIC Checks the model signature, runs a prediction smoke test, and applies the AUC threshold and the comparison with the current `@champion`. Results are tags on the model version. When all pass, the version becomes `@challenger`. Any failure fails the run before an alias moves.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_model_release", ['catalog', 'schema', 'use_case', 'min_auc', 'max_auc_regression', 'champion_alias', 'challenger_alias'])
dbutils.widgets.text("model_version", "")

import math
import common
import mlflow
import mlflow.pyfunc
import mlflow.sklearn
from mlflow.tracking import MlflowClient
from sklearn.metrics import roc_auc_score

catalog, schema = params["catalog"], params["schema"]
spec = common.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
model_name = common.full_model_name(catalog, schema, spec)
features, label = spec["features"], spec["label"]["name"]
mlflow.set_registry_uri("databricks-uc")
client = MlflowClient(registry_uri="databricks-uc")

# In the job, the version comes from train_and_register. Standalone, a blank widget takes the latest version.
model_version = dbutils.widgets.get("model_version").strip() or str(
    max(int(v.version) for v in client.search_model_versions(f"name = '{model_name}'"))
)
print(f"Testing {model_name} version {model_version}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Signature check

# COMMAND ----------

def check_signature(model_name: str, version: str, features: list[str]) -> tuple[bool, str]:
    info = mlflow.models.get_model_info(f"models:/{model_name}/{version}")
    sig = info.signature
    if sig is None:
        return False, "model has no signature"
    names = [c.name for c in sig.inputs.inputs]
    types = {c.type.name if hasattr(c.type, "name") else str(c.type) for c in sig.inputs.inputs}
    ok = names == features and types == {"double"} and sig.outputs is not None
    return ok, f"inputs={names} types={sorted(types)}"


pdf = spark.table(common.training_table(catalog, schema, spec)).toPandas()
_, holdout = common.split_frame(pdf, spec)
results: list[tuple[str, bool, str]] = []
ok, detail = check_signature(model_name, model_version, features)
results.append(("schema_and_signature", ok, detail))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Smoke test and quality gates

# COMMAND ----------

candidate = mlflow.sklearn.load_model(f"models:/{model_name}/{model_version}")
candidate_auc = roc_auc_score(holdout[label], candidate.predict_proba(holdout[features])[:, 1])

pyfunc_model = mlflow.pyfunc.load_model(f"models:/{model_name}/{model_version}")
sample = holdout[features].head(5)
preds = list(pyfunc_model.predict(sample))
smoke_ok = len(preds) == len(sample) and all(math.isfinite(float(x)) and float(x) in (0.0, 1.0) for x in preds)
results.append(("prediction_smoke_test", smoke_ok, f"{len(preds)} predictions: {preds}"))

champion_auc = None
try:
    champ = client.get_model_version_by_alias(model_name, params["champion_alias"])
    if str(champ.version) != str(model_version):
        champ_model = mlflow.sklearn.load_model(f"models:/{model_name}@{params['champion_alias']}")
        champion_auc = roc_auc_score(holdout[label], champ_model.predict_proba(holdout[features])[:, 1])
except mlflow.exceptions.MlflowException:
    pass  # no champion yet
results.extend(common.evaluate_gates(candidate_auc, float(params["min_auc"]), champion_auc, float(params["max_auc_regression"])))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Record the results and set `@challenger`

# COMMAND ----------

for name, passed, detail in results:
    print(f"{'PASS' if passed else 'FAIL'} {name}: {detail}")
    client.set_model_version_tag(model_name, model_version, f"test_{name}", "pass" if passed else "fail")

all_passed = all(passed for _, passed, _ in results)
client.set_model_version_tag(model_name, model_version, "tests_passed", str(all_passed).lower())
client.set_model_version_tag(model_name, model_version, "test_auc", f"{candidate_auc:.4f}")
if not all_passed:
    raise Exception("Release tests failed; version stays unaliased.")

client.set_registered_model_alias(model_name, params["challenger_alias"], model_version)
dbutils.jobs.taskValues.set(key="test_auc", value=round(candidate_auc, 4))
print(f"Set @{params['challenger_alias']} -> version {model_version}")
