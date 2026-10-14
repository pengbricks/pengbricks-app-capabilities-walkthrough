"""Automated release tests. All pass: set @challenger. Any failure: fail the run."""

import argparse
import math
import sys

p = argparse.ArgumentParser()
p.add_argument("--catalog", required=True)
p.add_argument("--schema", required=True)
p.add_argument("--src-dir", required=True)
p.add_argument("--spec", required=True)
p.add_argument("--model-version", required=True)
p.add_argument("--min-auc", type=float, required=True)
p.add_argument("--max-auc-regression", type=float, required=True)
p.add_argument("--champion-alias", default="champion")
p.add_argument("--challenger-alias", default="challenger")
args = p.parse_args()
sys.path.insert(0, args.src_dir)

import mlflow
import mlflow.pyfunc
import mlflow.sklearn
from databricks.sdk.runtime import dbutils, spark
from mlflow.tracking import MlflowClient
from sklearn.metrics import roc_auc_score

import common


def check_signature(model_name: str, version: str, features: list[str]) -> tuple[bool, str]:
    info = mlflow.models.get_model_info(f"models:/{model_name}/{version}")
    sig = info.signature
    if sig is None:
        return False, "model has no signature"
    names = [c.name for c in sig.inputs.inputs]
    types = {c.type.name if hasattr(c.type, "name") else str(c.type) for c in sig.inputs.inputs}
    ok = names == features and types == {"double"} and sig.outputs is not None
    return ok, f"inputs={names} types={sorted(types)}"


def main() -> None:
    spec = common.load_spec(args.spec)
    model_name = common.full_model_name(args.catalog, args.schema, spec)
    features, label = spec["features"], spec["label"]["name"]
    mlflow.set_registry_uri("databricks-uc")
    client = MlflowClient(registry_uri="databricks-uc")

    pdf = spark.table(common.training_table(args.catalog, args.schema, spec)).toPandas()
    _, holdout = common.split_frame(pdf, spec)

    results: list[tuple[str, bool, str]] = []

    ok, detail = check_signature(model_name, args.model_version, features)
    results.append(("schema_and_signature", ok, detail))

    candidate = mlflow.sklearn.load_model(f"models:/{model_name}/{args.model_version}")
    candidate_auc = roc_auc_score(holdout[label], candidate.predict_proba(holdout[features])[:, 1])

    pyfunc_model = mlflow.pyfunc.load_model(f"models:/{model_name}/{args.model_version}")
    sample = holdout[features].head(5)
    preds = list(pyfunc_model.predict(sample))
    smoke_ok = len(preds) == len(sample) and all(math.isfinite(float(x)) and float(x) in (0.0, 1.0) for x in preds)
    results.append(("prediction_smoke_test", smoke_ok, f"{len(preds)} predictions: {preds}"))

    champion_auc = None
    try:
        champ = client.get_model_version_by_alias(model_name, args.champion_alias)
        if str(champ.version) != str(args.model_version):
            champ_model = mlflow.sklearn.load_model(f"models:/{model_name}@{args.champion_alias}")
            champion_auc = roc_auc_score(holdout[label], champ_model.predict_proba(holdout[features])[:, 1])
    except mlflow.exceptions.MlflowException:
        pass  # no champion yet
    results.extend(common.evaluate_gates(candidate_auc, args.min_auc, champion_auc, args.max_auc_regression))

    for name, passed, detail in results:
        print(f"{'PASS' if passed else 'FAIL'} {name}: {detail}")
        client.set_model_version_tag(model_name, args.model_version, f"test_{name}", "pass" if passed else "fail")

    all_passed = all(passed for _, passed, _ in results)
    client.set_model_version_tag(model_name, args.model_version, "tests_passed", str(all_passed).lower())
    client.set_model_version_tag(model_name, args.model_version, "test_auc", f"{candidate_auc:.4f}")
    if not all_passed:
        raise SystemExit("Release tests failed; version stays unaliased.")

    client.set_registered_model_alias(model_name, args.challenger_alias, args.model_version)
    dbutils.jobs.taskValues.set(key="test_auc", value=round(candidate_auc, 4))
    print(f"Set @{args.challenger_alias} -> version {args.model_version}")


main()
