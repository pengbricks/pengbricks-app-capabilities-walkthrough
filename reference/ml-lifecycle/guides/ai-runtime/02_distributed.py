# Databricks notebook source
# MAGIC %pip install -q scikit-learn pyarrow pyyaml "mlflow>=3.1" databricks-sdk

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Distribute across the GPUs of one node
# MAGIC
# MAGIC The same model as `01_train_on_gpu`, trained with PyTorch DistributedDataParallel through `@distributed` from `databricks.air` (AI Runtime SDK, **Beta**, single node only). The `distributed` parameter gates it. With `false` (the default) this notebook trains on the one attached GPU and registers under the `gpu_distributed` alias, so a default run costs the same as `01`. With `true` it runs on every GPU of the node.
# MAGIC
# MAGIC Safe to rerun: the experiment is reused, each run adds an MLflow run and a model version (versions are history), and the `gpu_distributed` alias is moved, not added.
# MAGIC
# MAGIC **Required setup for `distributed = true`:** connect to **Serverless GPU** with **8xH100** (or 8xB300) and GPU environment version 6 or later, which includes `databricks-sdk-air`. In the job, deploy with `--var distributed_accelerator=GPU_8xH100` and run with `--params distributed=true`. `@distributed` needs a multi-GPU accelerator (the notebook stops early on a single GPU). 8xB300 is a Public Preview waitlist, and 8xH100 is Beta in the bundle schema, so both depend on quota in your region.
# MAGIC
# MAGIC **Not yet run on 8xH100.** Three behaviours rest on the docs and not on a run: (1) the docs say return values are collected from all ranks but do not name the type, so the notebook accepts a list or a single value; (2) the docs show `train.distributed()` with no arguments, and this notebook passes arguments; (3) the docs do not say how local modules reach the rank processes, so each rank adds `src/` to `sys.path` and imports `gpu_churn` itself. Both (2) and (3) assume the ranks run on this node and can read the workspace path. If your run fails at the import, copy `gpu_churn.py` into the function or install it as a wheel.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_ai_runtime", ['catalog', 'schema', 'use_case', 'source_volume', 'release', 'experiment', 'epochs', 'distributed'],
                     defaults={"distributed": "false"})
catalog, schema = params["catalog"], params["schema"]
use_distributed = params["distributed"].lower() == "true"

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

SRC = os.path.abspath("../../src")
spec = c.load_spec(str(bundle_root() / "use_cases" / f"{params['use_case']}.yml"))
if not torch.cuda.is_available():
    raise RuntimeError("No GPU is attached. Connect this notebook to Serverless GPU (AI Runtime) and choose an accelerator, then rerun.")
gpus = torch.cuda.device_count()
if use_distributed and gpus < 2:
    raise RuntimeError(f"distributed=true needs a multi-GPU accelerator such as 8xH100, but this node has {gpus} GPU. Pick one, or set distributed=false.")

features, label, key = spec["model"]["features"], spec["label"]["name"], spec["source"]["key"]
epochs, seed = int(params["epochs"]), spec["seed"]
parquet = g.snapshot_path(catalog, schema, params["source_volume"])
print(f"GPUs on this node: {gpus}; distributed={use_distributed}")

# COMMAND ----------

def train_rank(parquet, features, label, key, holdout_mod, epochs, seed, src):
    """Runs once per GPU. Loads its own data, trains one shard under DDP, and returns the result from rank 0."""
    import os, sys
    import pandas as pd
    import torch
    import torch.distributed as dist
    from torch.nn.parallel import DistributedDataParallel as DDP

    sys.path.insert(0, src)
    import gpu_churn as g

    local_rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(local_rank)
    dist.init_process_group(backend="nccl")
    try:
        rank, world = dist.get_rank(), dist.get_world_size()
        x_train, y_train, x_hold, y_hold = g.split_arrays(pd.read_parquet(parquet), features, label, key, holdout_mod)
        torch.manual_seed(seed % 2**31)
        model = DDP(g.build_model(len(features)).to("cuda"), device_ids=[local_rank])
        xs, ys = g.shard(x_train, y_train, rank, world)
        # DDP all-reduces every step, so each rank must run the same number of batches. Trim shards to equal length.
        keep = len(x_train) // world
        xs, ys = xs[:keep], ys[:keep]
        losses = g.fit(model, xs, ys, "cuda", epochs, seed=seed + rank)
        if rank != 0:
            return None
        return {"world_size": world, "gpu": torch.cuda.get_device_name(local_rank), "losses": losses,
                "auc": g.holdout_auc(model.module, x_hold, y_hold, "cuda"), "state": g.state_to_lists(model.module)}
    finally:
        dist.destroy_process_group()

# COMMAND ----------

mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment(params["experiment"])
model_name = f"{catalog}.{schema}.{g.GPU_MODEL_NAME}"
holdout_mod = spec["model"]["holdout_mod"]

with mlflow.start_run(run_name=f"train-ddp-{gpus if use_distributed else 1}gpu"):
    if use_distributed:
        from databricks.air import distributed

        # num_accelerators defaults to every GPU on the node. Each .distributed() call also creates an MLflow run (a child of this one).
        train = distributed(num_accelerators=gpus)(train_rank)
        results = train.distributed(parquet, features, label, key, holdout_mod, epochs, seed, SRC)
        result = next(r for r in (results if isinstance(results, (list, tuple)) else [results]) if r)
    else:
        x_train, y_train, x_hold, y_hold = g.split_arrays(pd.read_parquet(parquet), features, label, key, holdout_mod)
        torch.manual_seed(seed % 2**31)
        single = g.build_model(len(features)).to("cuda")
        losses = g.fit(single, x_train, y_train, "cuda", epochs, seed=seed)
        result = {"world_size": 1, "gpu": torch.cuda.get_device_name(0), "losses": losses,
                  "auc": g.holdout_auc(single, x_hold, y_hold, "cuda"), "state": g.state_to_lists(single)}
    x_hold = g.split_arrays(pd.read_parquet(parquet), features, label, key, holdout_mod)[2]
    mlflow.log_params({"seed": seed, "epochs": epochs, "features": ",".join(features), "gpu": result["gpu"],
                       "gpu_count": result["world_size"], "distributed": use_distributed})
    mlflow.log_metric("holdout_auc", result["auc"])
    for step, loss in enumerate(result["losses"]):
        mlflow.log_metric("train_loss", loss, step=step)
    mlflow.set_tags({"release": params["release"], "torch": torch.__version__})
    model = g.model_from_lists(result["state"], len(features))
    info = mlflow.pytorch.log_model(
        model, name="model", registered_model_name=model_name,
        signature=infer_signature(x_hold[:3], model(torch.from_numpy(x_hold[:3])).detach().numpy()),
        input_example=x_hold[:3],
    )
MlflowClient(registry_uri="databricks-uc").set_registered_model_alias(model_name, g.ALIAS_DISTRIBUTED, info.registered_model_version)
print(f"Registered {model_name} v{info.registered_model_version} on {result['world_size']} GPU(s), holdout AUC {result['auc']:.4f}")
