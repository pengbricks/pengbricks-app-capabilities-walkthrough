import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'ai-runtime',
  area: 'ML Guides',
  title: 'AI Runtime: serverless GPU for training and fine-tuning',
  intro:
    'AI Runtime is serverless GPU compute. You attach a notebook or submit a job, pick an accelerator and an environment version, and train without building a GPU cluster. The choices that matter are where to run, which GPU, how to spread a run over several GPUs, how to load data, how the run reaches Unity Catalog and Model Serving, how to move off the deprecated serverless_gpu package, and what bounds the cost. The reference job runs a small PyTorch churn model on the UCI data the other ML guides use.',
  businessValue: {
    summary:
      'Teams train and fine-tune on GPUs without owning GPU clusters. Platform owners pay for the time a run uses, not for idle capacity, and every run lands in MLflow and Unity Catalog.',
    outcomes: [
      {
        title: 'No idle GPU bill',
        body: 'A run bills while it executes. There is no cluster to forget to stop, so the cost question becomes how long a run takes and which accelerator it needs.',
      },
      {
        title: 'Faster start',
        body: 'GPUs are available on demand, not after a cluster start of several minutes. Data scientists iterate in a notebook and schedule the same code as a job.',
      },
      {
        title: 'Governed output',
        body: 'Data comes from Unity Catalog volumes and tables, and the result is an MLflow run and a registered model with an alias, the same path as any other model.',
      },
      {
        title: 'A migration to plan',
        body: 'Code that imports serverless_gpu keeps working on GPU environment version 6 and breaks on version 7. Owners should schedule the move to databricks.air now.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Start on one A10 in a notebook.',
      body: 'Choose Serverless GPU, 1xA10, and the Databricks AI environment. Move to H100 only when the model or batch does not fit in 24 GB, and to 8xH100 only when one GPU is too slow.',
    },
    {
      title: 'Use @distributed before you reach for multinode.',
      body: 'The @distributed decorator (Beta) runs DDP, FSDP, or DeepSpeed across the 8 GPUs of one node from a notebook. Go multinode through the AI Runtime CLI when 8 GPUs are not enough.',
    },
    {
      title: 'Read data from volumes, not DBFS.',
      body: 'AI Runtime has no local Spark, so tables are read through Spark Connect. Unstructured data comes from Unity Catalog volumes, and large tables go to Parquet in a volume first. Use databricks.air.data for loading and checkpoints.',
    },
    {
      title: 'Track and register the same way as any model.',
      body: 'MLflow tracking is built in. Log the model, register it in Unity Catalog, and move an alias. Serving is a separate step on Model Serving.',
    },
    {
      title: 'Migrate off serverless_gpu on version 6.',
      body: 'Version 6 includes both packages and is the last to include serverless_gpu. Rename the import and the arguments now, because support ends in version 7.',
    },
    {
      title: 'Bound the cost with the job, not the cluster.',
      body: 'Set a job timeout, keep max_concurrent_runs at 1, and start with the smallest accelerator. Sessions and jobs have hard time limits of their own.',
    },
  ],
  sections: [
    {
      id: 'what-it-is',
      heading: 'What AI Runtime is, and how it differs',
      prose:
        'AI Runtime is a fully managed serverless GPU offering for training, fine-tuning, and batch inference. You do not provision GPU nodes or networking. It supports interactive notebooks, jobs, the AI Runtime CLI for submitting workloads from a laptop, and Ray (Core, Data, Train, and Tune). It is not an inference service. Trained models go to Model Serving.',
      diagram: {
        type: 'flow',
        title: 'From Unity Catalog data to a served model',
        description:
          'Training data in Unity Catalog volumes and tables is read by an AI Runtime notebook or job. The run logs to MLflow, the model registers in Unity Catalog, and Model Serving hosts it.',
        nodes: [
          {
            id: 'data',
            label: 'UC volumes and tables',
            sub: 'training data',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Parquet, images, text, and tables in Unity Catalog. Large tables are exported to Parquet in a volume for training.',
          },
          {
            id: 'nb',
            label: 'AI Runtime notebook',
            sub: 'interactive, 1xA10 first',
            col: 1,
            row: 0,
            kind: 'highlight',
            icon: 'gear-lava',
            domain: 'ai',
            detail: 'A notebook attached to Serverless GPU. Develop and test here before you schedule the code.',
          },
          {
            id: 'job',
            label: 'AI Runtime job',
            sub: 'scheduled or one-off',
            col: 1,
            row: 1,
            kind: 'surface',
            icon: 'workflow',
            domain: 'orchestration',
            detail: 'A notebook task with a GPU compute setting, or an ai_runtime_task for multi-node command scripts.',
          },
          {
            id: 'mlflow',
            label: 'MLflow run',
            sub: 'params, metrics, logs',
            col: 2,
            row: 0,
            icon: 'list',
            domain: 'ai',
            detail:
              'Tracking is built in. The run holds parameters, metrics, the model, and per-node logs for 60 days.',
          },
          {
            id: 'model',
            label: 'UC registered model',
            sub: 'version plus alias',
            col: 3,
            row: 0,
            kind: 'store',
            icon: 'data-model',
            domain: 'governance',
            detail: 'The model registers in Unity Catalog. An alias marks the version that downstream steps use.',
          },
          {
            id: 'serving',
            label: 'Model Serving',
            sub: 'online scoring',
            col: 4,
            row: 0,
            kind: 'surface',
            icon: 'cloud-network',
            domain: 'apps',
            detail: 'A serving endpoint reads the aliased version. AI Runtime itself does not serve models.',
          },
        ],
        edges: [
          { from: 'data', to: 'nb' },
          { from: 'data', to: 'job' },
          { from: 'nb', to: 'mlflow' },
          { from: 'job', to: 'mlflow' },
          { from: 'mlflow', to: 'model' },
          { from: 'model', to: 'serving' },
        ],
        legend: [
          { kind: 'store', label: 'Unity Catalog asset' },
          { kind: 'highlight', label: 'AI Runtime' },
        ],
      },
      options: {
        caption: 'Where to train',
        rows: [
          {
            option: 'AI Runtime (serverless GPU)',
            when: 'Training, fine-tuning, or batch inference on open models and your own code, with a notebook, job, or CLI.',
            tradeoffs:
              'On-demand GPUs with no cluster to size or stop, and automated GPU health checks. No local Spark (the classic-migration page says to use Spark Connect), data comes from volumes, and capacity depends on your workspace and geo. The docs say it can borrow cross-region GPUs in high demand.',
          },
          {
            option: 'Classic GPU cluster',
            when: 'You need a Databricks Runtime ML library set, Spark-based distributed training such as TorchDistributor, DBFS paths, or settings AI Runtime does not expose.',
            tradeoffs:
              'You pick the instance, networking, and runtime, and pay while the cluster is up. Startup can take several minutes. The docs call it not optimized for multinode training, and it has no dedicated GPU CLI.',
          },
          {
            option: 'Foundation Model Fine-tuning (managed)',
            when: 'You want a managed fine-tuning API for a supported base model and do not want to write a training loop.',
            tradeoffs:
              'Less code and less control: the base models, methods, and hyperparameters are the ones the service lists. The release notes show models retired from it over time, so check the current docs for what is supported before you plan on it.',
          },
          {
            option: 'Model Serving',
            when: 'You are hosting a trained model for online scoring.',
            tradeoffs:
              'Serving is inference, not training, and it is the next step after any of the three options above.',
          },
        ],
        recommendation:
          'Use AI Runtime for new GPU training and fine-tuning, and keep classic GPU clusters for code that depends on Spark-based distribution or DBFS. Treat Model Serving as the deployment step.',
      },
      links: [
        { label: 'AI Runtime', url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/' },
        {
          label: 'Why AI Runtime',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/guides/why-ai-runtime',
        },
        {
          label: 'Migrate classic GPU workloads',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/guides/migrate-classic-workloads',
        },
      ],
    },
    {
      id: 'hardware',
      heading: 'Accelerators and environment versions',
      prose:
        'The accelerator sets the memory you get and whether distributed training is available. The environment sets the packages. Both are part of the run record, so log them.',
      table: {
        caption: 'Accelerators in the AI Runtime docs',
        columns: ['Accelerator', 'What the docs say'],
        rows: [
          ['1xA10', '1 GPU, 24 GB. Small to medium work. No distributed training.'],
          ['1xH100', '1 GPU, 80 GB. Medium models. No distributed training.'],
          ['8xH100', '8 GPUs at 80 GB each. Large workloads. Distributed training supported.'],
          ['8xB300', '8 GPUs at 288 GB each. Largest models. Public Preview, by waitlist.'],
        ],
      },
      options: {
        caption: 'GPU type',
        rows: [
          {
            option: '1xA10',
            when: 'Development, small models, tabular and classic ML, and short fine-tuning runs that fit in 24 GB.',
            tradeoffs:
              'The cheapest place to find bugs and the default for a notebook. Out of memory is the limit, and there is no multi-GPU path.',
          },
          {
            option: '1xH100',
            when: 'A model or batch that needs up to 80 GB on one GPU, such as a mid-size model with parameter-efficient fine-tuning.',
            tradeoffs:
              'More memory and speed per GPU, at a higher rate than an A10. Still one GPU, so you cannot use @distributed.',
          },
          {
            option: '8xH100',
            when: 'One GPU is too slow or too small, or you shard a model with FSDP or DeepSpeed on one node.',
            tradeoffs:
              'The only documented target for @distributed besides 8xB300. You pay for all 8 GPUs while the run is up, so measure that scaling is close to linear before you commit.',
          },
          {
            option: '8xB300',
            when: 'The largest models, and only if you are on the waitlist.',
            tradeoffs: 'Public Preview with a waitlist, so capacity and terms can change. Plan a fallback to 8xH100.',
          },
        ],
        recommendation:
          'Start on 1xA10. Move to 1xH100 when memory is the limit, and to 8xH100 when time is the limit and the code already uses DDP, FSDP, or DeepSpeed.',
      },
      points: [
        {
          strong: 'Two pre-built environments.',
          text: 'Standard is minimal and gives you control of dependencies. The Databricks AI environment has the ML stack (PyTorch, Transformers, vLLM, pandas) installed. Versions 4, 5, and 6 are documented, and version 6 is current. On Standard version 6, install PyTorch yourself.',
        },
        {
          strong: 'Custom images.',
          text: 'A custom Docker image is supported for dependencies that do not install cleanly. It adds an image to build and keep patched.',
        },
        {
          strong: 'Installing packages.',
          text: 'In a notebook, use %pip install with a pinned version, as the classic-migration page does. In a job, list dependencies in the environment spec.',
        },
        {
          strong: 'No local Spark.',
          text: 'The classic-migration page says to replace local Spark DataFrame operations with Spark Connect, to replace DBFS paths with volume paths, and to drop TorchDistributor. The reference job takes the simple route: Spark work runs on a serverless CPU task, which writes Parquet to a volume, and the GPU task reads that file.',
        },
        {
          strong: 'Stages differ by source.',
          text: 'The docs overview (updated October 21, 2026) calls most features generally available, with 8xB300, workspace base environments in jobs, and @distributed as exceptions. The bundle schema in CLI 1.17 labels the A10 and H100 job accelerators and the task-level GPU compute field Beta. Check the stage in your workspace before you promise a date.',
        },
      ],
      links: [
        {
          label: 'Pre-built environments',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/develop-workloads/environment',
        },
        {
          label: 'Quickstart: notebooks',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/connecting/notebooks',
        },
      ],
    },
    {
      id: 'jobs',
      heading: 'Notebooks, jobs, scheduling, and the terminal',
      prose:
        'Develop in a notebook, then run the same code as a job. In a notebook, choose Serverless GPU in the compute menu, pick 1xA10 in the Accelerator field, and apply. The notebook has a GPU monitoring panel and a Terminal button for a shell on the GPU node. The web terminal on AI Runtime is in Public Preview. A job runs the notebook on a schedule, with the accelerator and environment version written in the bundle.',
      examples: [
        {
          label: 'A notebook task on a GPU, in a bundle',
          language: 'yaml',
          code: `environments:
  - environment_key: gpu
    spec:
      environment_version: '6'
      dependencies:
        - torch
tasks:
  - task_key: train_on_gpu
    environment_key: gpu
    compute:
      hardware_accelerator: GPU_1xA10
    notebook_task:
      notebook_path: ../guides/ai-runtime/01_train_on_gpu.py`,
          notes: [
            'The reference job uses this form. In the CLI 1.17 bundle schema, compute.hardware_accelerator is Beta and accepts GPU_1xA10, GPU_1xH100, and GPU_8xH100, plus GPU_8xB300, which the schema marks Private Preview.',
          ],
        },
        {
          label: 'An ai_runtime_task for a command script, adapted from the docs',
          language: 'yaml',
          code: `ai_runtime_task:
  experiment: scheduled-training
  deployments:
    - command_path: \${workspace.file_path}/command.sh
      compute:
        accelerator_type: GPU_1xA10
        accelerator_count: 1`,
          notes: [
            'Public Preview in the bundle schema. It supports one deployment, where every node runs the same command. The docs scheduling example also sets code_source_path, which the CLI 1.17 schema marks Private Preview and not for direct callers, so this sketch leaves it out and expects you to upload command.sh to the workspace path.',
            'A schedule block with quartz_cron_expression, timezone_id, and pause_status sits on the job, and max_concurrent_runs: 1 stops overlapping runs.',
          ],
        },
      ],
      options: {
        caption: 'How to run the code',
        rows: [
          {
            option: 'Interactive notebook',
            when: 'Developing, debugging, and checking GPU memory with the monitor panel and terminal.',
            tradeoffs:
              'Fastest feedback. A connection attempt ends after 15 minutes, a session runs up to two days, and terminating the notebook ends a @distributed run. Not a production path.',
          },
          {
            option: 'Notebook task in a job',
            when: 'Scheduled or triggered training from code you already tested in a notebook.',
            tradeoffs:
              'Same code, a schedule, retries, and alerts. A connection attempt ends after 24 hours and a notebook job runs up to two days. GPU compute on a task is Beta in the bundle schema.',
          },
          {
            option: 'ai_runtime_task or the CLI',
            when: 'Multinode training, a command script such as torchrun or accelerate, or submitting from a laptop with a YAML job config.',
            tradeoffs:
              'The longest runs (CLI jobs up to 14 days) and the only documented multinode path. It is a script, not a notebook, and the task type is Public Preview.',
          },
        ],
        recommendation:
          'Develop in a notebook on 1xA10, then schedule the notebook as a job. Move to ai_runtime_task or the CLI when you need more than one node.',
      },
      links: [
        {
          label: 'Schedule AI Runtime workloads',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/monitor-deploy/productionizing-training-workloads',
        },
        {
          label: 'Connect with the CLI',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/connecting/cli/',
        },
      ],
    },
    {
      id: 'distribute',
      heading: 'Single GPU, @distributed, multinode, and Ray',
      prose:
        'Scale in steps, and stop at the first one that is fast enough. @distributed is Beta and runs a function once per GPU on the node your notebook is attached to. It supports PyTorch DDP, FSDP, and DeepSpeed. You still write the distributed code. Each .distributed() call creates an MLflow run, nested under your active run if there is one.',
      examples: [
        {
          label: 'Run a function on every GPU of an 8xH100 node',
          language: 'python',
          code: `from databricks.air import distributed

@distributed(num_accelerators=8, accelerator_type="GPU_8xH100")
def train():
    import os, torch, torch.distributed as dist
    local_rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(local_rank)
    dist.init_process_group(backend="nccl")
    try:
        # Load data here, then run DDP, FSDP, or DeepSpeed.
        return {"rank": dist.get_rank(), "world_size": dist.get_world_size()}
    finally:
        dist.destroy_process_group()

results = train.distributed()`,
          notes: [
            'num_accelerators defaults to every GPU on the node. accelerator_type is optional. timeout is in seconds and defaults to 3 hours, and timeout=None turns it off.',
            'The docs say return values are collected from all ranks and returned to the caller. They do not name the type, so do not rely on a list: the reference notebook accepts a list or a single value and picks the rank 0 result.',
            'Load data inside the function so each rank reads its own shard.',
          ],
        },
        {
          label: 'Ray in a notebook',
          language: 'python',
          code: `from databricks.air import ray_init
ray_init()`,
          notes: [
            'For Ray across several nodes, use the CLI: node 0 starts the Ray head and the other nodes start workers, and your code connects with ray.init(address="auto").',
          ],
        },
      ],
      options: {
        caption: 'Distributed strategy',
        rows: [
          {
            option: 'Single GPU',
            when: 'The model and a batch fit in one GPU and the run finishes in minutes to a few hours. Also the right place to debug every training script.',
            tradeoffs:
              'No coordination code and the lowest rate. It is the baseline against which you measure any speedup. 1xA10 and 1xH100 cannot run @distributed.',
          },
          {
            option: '@distributed on one node',
            when: 'DDP for speed, or FSDP or DeepSpeed for a model that does not fit on one GPU, with up to 8 GPUs and a notebook workflow.',
            tradeoffs:
              'Single-node only, Beta, and it needs 8xH100 or 8xB300 (8xB300 is a Public Preview waitlist). Little code change from a single-GPU script. Terminating the notebook ends the run, and the default timeout is 3 hours.',
          },
          {
            option: 'Multinode through the CLI',
            when: 'Training that needs more than 8 GPUs, or runs longer than a notebook session.',
            tradeoffs:
              'Scales past one node and supports long jobs. You write the launcher command (torchrun, accelerate) and handle node coordination, and the work is a script, not a notebook.',
          },
          {
            option: 'ray_init or Ray multinode',
            when: 'You already use Ray Train, Ray Tune, or Ray Data for batch inference with vLLM across GPUs.',
            tradeoffs:
              'Good for tuning and data-parallel inference. It adds Ray concepts to learn, and multinode Ray goes through the CLI, not a notebook.',
          },
        ],
        recommendation:
          'Stay on a single GPU until you have a measured reason. Then move to @distributed on 8xH100 and compare time per epoch to the single GPU. Go multinode only when 8 GPUs are not enough.',
      },
      links: [
        {
          label: 'Distributed training',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/distributed-training',
        },
        {
          label: 'Ray on AI Runtime',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/develop-workloads/ray',
        },
        {
          label: 'Example workloads (AI Runtime Cookbook)',
          url: 'https://github.com/databricks-solutions/ai-runtime-cookbook',
        },
      ],
    },
    {
      id: 'data',
      heading: 'Load data from Unity Catalog',
      prose:
        'AI Runtime reads Unity Catalog volumes for unstructured and large data, and Unity Catalog tables through Spark Connect for structured data. DBFS paths are not supported. databricks.air.data provides loaders and checkpoint readers and writers that handle the I/O for you.',
      examples: [
        {
          label: 'Stream files from a volume and write checkpoints to one',
          language: 'python',
          code: `from databricks.air.data import UCVolumeDataset, DataLoader, UCVolumeWriter, UCVolumeReader

dataset = UCVolumeDataset("/Volumes/main/ml/training/images")
loader = DataLoader(dataset, batch_size=64)

writer = UCVolumeWriter("/Volumes/main/ml/checkpoints/run1")
reader = UCVolumeReader("/Volumes/main/ml/checkpoints/run1")`,
          notes: [
            'UCVolumeDataset is a PyTorch IterableDataset. The docs recommend this DataLoader over the standard PyTorch one.',
            'The writer and reader are for distributed checkpointing. Do not checkpoint to DBFS or local disk.',
          ],
        },
      ],
      options: {
        caption: 'How the data reaches the GPU',
        rows: [
          {
            option: 'Files in a Unity Catalog volume',
            when: 'Images, audio, text, model assets, and anything already stored as files.',
            tradeoffs:
              'Streams with UCVolumeDataset and scales with the data. Many small files are slow, so the docs advise 1 GiB to 10 GiB per file and copying small files to local disk first.',
          },
          {
            option: 'Parquet exported to a volume',
            when: 'A Delta table too large for toPandas(), or a table you read many times.',
            tradeoffs:
              'Load with PyTorch or Hugging Face directly and skip Spark during training. It is a copy that can go stale, so rebuild it in a CPU task at the start of the job, as the reference job does.',
          },
          {
            option: 'A table through Spark Connect',
            when: 'Small to medium tabular data you want straight from a table.',
            tradeoffs:
              'Direct and governed by table permissions. toPandas() fails on tables that are too large, and Spark runs remotely, not on the GPU node.',
          },
        ],
        recommendation:
          'Use volumes for files. For tables, export Parquet to a volume in a CPU task and read the file on the GPU. Use a table read directly only when it is small.',
      },
      links: [
        {
          label: 'Load data',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/develop-workloads/dataloading',
        },
      ],
    },
    {
      id: 'track',
      heading: 'Log to MLflow and register in Unity Catalog',
      prose:
        'MLflow tracking is built into AI Runtime. Log parameters, metrics, and the model as you would anywhere else, and register it in Unity Catalog. For the logging pattern, the signature, and the alias workflow, follow Training and bringing existing models and Reproducible experiments. Three things are specific to GPU runs.',
      points: [
        {
          strong: 'Record the hardware.',
          text: 'Log the GPU name, the GPU count, and the environment version as parameters or tags. A run on 8 GPUs and a run on 1 are not the same experiment.',
        },
        {
          strong: 'Logs live on the run.',
          text: 'Since October 15, 2026 the run page has a Logs tab for AI Runtime runs. It filters by node, level, and time range, follows a running job, and keeps logs for 60 days. The old log files on the Artifacts tab are deprecated for new runs.',
        },
        {
          strong: 'Keep the registration idempotent.',
          text: 'Use one experiment name, let each run add a model version, and move an alias to the version you want. The reference notebooks set gpu_trained and gpu_distributed, so a rerun moves aliases and does not pile them up.',
        },
        {
          strong: 'Serve it separately.',
          text: 'AI Runtime ends at the registered model. Deploy with the release pipeline and score through Model Serving.',
        },
      ],
      links: [
        {
          label: 'Tracking and observability on AI Runtime',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/monitor-deploy/tracking-observability',
        },
        {
          label: 'Model Serving',
          url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/',
        },
      ],
    },
    {
      id: 'migrate',
      heading: 'Migrate from serverless_gpu to databricks-sdk-air',
      prose:
        'On October 13, 2026, starting in GPU environment version 6, the Databricks AI Runtime SDK (databricks-sdk-air) replaced the deprecated serverless_gpu package. It provides the @distributed and ray_init APIs and the databricks.air.data utilities under the databricks.air namespace. Version 6 includes both packages and is the last version that includes serverless_gpu. Versions 5 and below keep using serverless_gpu.',
      examples: [
        {
          label: 'Before and after',
          language: 'python',
          code: `# Before: serverless_gpu, GPU environment version 5 and below
from serverless_gpu import distributed

@distributed(gpus=8, gpu_type="H100")
def train():
    ...

# After: databricks.air, GPU environment version 6 and above
from databricks.air import distributed

@distributed(num_accelerators=8, accelerator_type="GPU_8xH100")
def train():
    ...

train.distributed()`,
          notes: [
            'The docs map gpus to num_accelerators, gpu_type to accelerator_type, and "H100" to a value such as "GPU_8xH100".',
            'The data utilities live under databricks.air.data. The docs table covers only the distributed import and arguments, so check the rest of your serverless_gpu imports by hand.',
            'The release note says the old names still work in databricks.air but raise a FutureWarning, and support ends in GPU environment version 7.',
          ],
        },
      ],
      options: {
        caption: 'When to migrate',
        rows: [
          {
            option: 'Migrate now, on version 6',
            when: 'Any notebook or job that uses @distributed or the data utilities, and anything you plan to keep past the next environment version.',
            tradeoffs:
              'A small edit with a warning-free result. You test once on version 6, which still has both packages, so you can roll back.',
          },
          {
            option: 'Stay on version 5 and serverless_gpu',
            when: 'A pinned workload you will not change soon, and that has no need for the databricks.air features.',
            tradeoffs:
              'No code change, but the package is deprecated and version 6 is the last version that ships it. You move to a newer environment later, with less time to test.',
          },
        ],
        recommendation:
          'Migrate on version 6. Treat FutureWarning output in job logs as the to-do list, and finish before version 7.',
      },
      links: [
        {
          label: 'Release note: AI Runtime SDK replaces serverless_gpu (October 13, 2026)',
          url: 'https://docs.databricks.com/aws/en/release-notes/product/2026/october',
        },
        {
          label: 'Distributed training and migration',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/connecting/distributed-training',
        },
      ],
    },
    {
      id: 'run-it',
      heading: 'Run the reference job',
      prose:
        'The ml-lifecycle bundle holds the reference code. Its job capability-guides-ai-runtime has three tasks. The first builds the churn snapshot on serverless CPU and writes Parquet to a volume. The second trains a small PyTorch model on 1xA10 and registers churn_classifier_gpu with the gpu_trained alias. The third runs the same model through @distributed when the distributed parameter is true, and otherwise trains on one GPU. It uses the checksum-verified UCI download that the other ML guides use, and it creates no endpoint or schedule, so nothing bills while idle.',
      steps: [
        {
          title: 'Check the setup',
          body: 'Confirm Serverless GPU appears in the notebook compute menu, the principal has schema and model privileges, and the workspace can reach the UCI host and PyPI.',
        },
        {
          title: 'Run the default job',
          body: 'Deploy the bundle and run the job. The default stays on one A10.',
          code: 'databricks bundle run capability_guides_ai_runtime --target dev',
        },
        {
          title: 'Try the multi-GPU path',
          body: 'Deploy with an 8xH100 accelerator for the last task, then set the parameter. Expect to need quota for it.',
          code: 'databricks bundle deploy --target dev --var distributed_accelerator=GPU_8xH100\ndatabricks bundle run capability_guides_ai_runtime --target dev --params distributed=true',
        },
      ],
    },
    {
      id: 'cost',
      heading: 'Cost and limits',
      prose:
        'The docs say you pay only for the compute your workloads use, with no idle cluster. They do not give a rate in the pages reviewed, so take prices from the Databricks pricing page and check the usage in your billable usage system table. The controls that bound cost are time, accelerator, and concurrency.',
      points: [
        {
          strong: 'Time limits.',
          text: 'A connection attempt ends after 15 minutes for interactive notebooks and 24 hours for notebook jobs and CLI jobs. A connected notebook session and a notebook job run up to two days, and a CLI job up to 14 days. @distributed times out after 3 hours unless you set timeout.',
        },
        {
          strong: 'Set job limits yourself.',
          text: 'Set timeout_seconds on the job, keep max_concurrent_runs at 1, and add a failure alert. A hung run bills until a limit stops it.',
        },
        {
          strong: 'Idle behavior.',
          text: 'The docs describe no idle cluster to pay for, and do not document an idle timeout for an attached notebook. Detach or close the notebook when you stop, and watch the GPU monitor panel.',
        },
        {
          strong: 'Quota and regions.',
          text: 'GPU availability varies by workspace, and the docs refer to AI Runtime availability by geo and to cross-geo processing. They also say it can use cross-region GPUs when demand is high. Confirm the geo, accelerator, and capacity with your account team before a large run.',
        },
        {
          strong: 'Compliance.',
          text: 'With the compliance security profile, an admin must enable the AI Runtime previews. FedRAMP High and DoD IL5 are not supported.',
        },
      ],
      links: [
        {
          label: 'AI Runtime overview',
          url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/overview',
        },
        { label: 'Databricks pricing', url: 'https://www.databricks.com/product/pricing' },
      ],
    },
  ],
  related: [
    { slug: 'model-training-compatibility', title: 'Training and bringing existing models' },
    { slug: 'experiment-tracking', title: 'Reproducible experiments' },
    { slug: 'real-time-scoring', title: 'Online model scoring' },
    { slug: 'model-deployment-cicd', title: 'Model release pipeline' },
    { slug: 'compute-capacity-management', title: 'Compute and capacity management' },
  ],
};
