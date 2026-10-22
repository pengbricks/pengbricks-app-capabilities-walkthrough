# Databricks notebook source
# MAGIC %pip install -q scikit-learn pyarrow pyyaml "mlflow>=3.1" databricks-sdk

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 1. Train on one GPU
# MAGIC
# MAGIC Trains a small PyTorch classifier on the churn snapshot from `00_prepare_data`, on the GPU this notebook is attached to, and logs the run to MLflow. It registers the model in Unity Catalog as `churn_classifier_gpu` and moves the `gpu_trained` alias to the new version. Safe to rerun: the experiment is reused, each run adds an MLflow run and a model version (versions are history), and the alias is moved, not added.
# MAGIC
# MAGIC **Required setup:** attach to **Serverless GPU** with a **1xA10** accelerator (AI Runtime) and the Databricks AI environment, version 6 or later (it includes PyTorch; the job installs `torch` on the Standard environment instead). In the job, the `train_on_gpu` task sets both. The notebook fails fast with a clear message when no GPU is attached.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_runtime", ['catalog', 'schema', 'use_case', 'source_volume', 'release', 'experiment', 'epochs'])
catalog, schema = params["catalog"], params["schema"]

import pandas as pd
try:
    import torch
except ModuleNotFoundError as error:  # torch ships in the AI Runtime (serverless GPU) environment
    raise RuntimeError("PyTorch is missing. Attach this notebook to AI Runtime (serverless GPU) compute as Required setup describes. Nothing was changed.") from error
import mlflow
from mlflow.models import infer_signature
from mlflow.tracking import MlflowClient
import ml_common as c
import gpu_churn as g

spec = c.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
if not torch.cuda.is_available():
    raise RuntimeError("No GPU is attached. Connect this notebook to Serverless GPU (AI Runtime) and choose an accelerator, then rerun.")
device = "cuda"
print("GPU:", torch.cuda.get_device_name(0))

# COMMAND ----------

features, label, key = spec["model"]["features"], spec["label"]["name"], spec["source"]["key"]
pdf = pd.read_parquet(g.snapshot_path(catalog, schema, params["source_volume"]))
x_train, y_train, x_hold, y_hold = g.split_arrays(pdf, features, label, key, spec["model"]["holdout_mod"])
epochs = int(params["epochs"])

# COMMAND ----------

torch.manual_seed(spec["seed"] % 2**31)
mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment(params["experiment"])
model_name = f"{catalog}.{schema}.{g.GPU_MODEL_NAME}"

with mlflow.start_run(run_name="train-gpu"):
    model = g.build_model(len(features)).to(device)
    losses = g.fit(model, x_train, y_train, device, epochs, seed=spec["seed"])
    auc = g.holdout_auc(model, x_hold, y_hold, device)
    mlflow.log_params({"seed": spec["seed"], "rows": len(pdf), "epochs": epochs, "features": ",".join(features),
                       "gpu": torch.cuda.get_device_name(0), "gpu_count": 1})
    mlflow.log_metric("holdout_auc", auc)
    for step, loss in enumerate(losses):
        mlflow.log_metric("train_loss", loss, step=step)
    mlflow.set_tags({"release": params["release"], "torch": torch.__version__})
    model = model.cpu()
    info = mlflow.pytorch.log_model(
        model, name="model", registered_model_name=model_name,
        signature=infer_signature(x_hold[:3], model(torch.from_numpy(x_hold[:3])).detach().numpy()),
        input_example=x_hold[:3],
    )
MlflowClient(registry_uri="databricks-uc").set_registered_model_alias(model_name, g.ALIAS_SINGLE, info.registered_model_version)
print(f"Registered {model_name} v{info.registered_model_version}, holdout AUC {auc:.4f}")
