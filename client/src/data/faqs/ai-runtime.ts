import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    kind: 'decision',
    question: 'Should I use AI Runtime or a classic GPU cluster?',
    answer:
      'Use AI Runtime for new training, fine-tuning, and batch inference. You get a GPU on demand and pay for the run, not an idle cluster. Keep a classic GPU cluster when the code depends on Spark-based distribution such as TorchDistributor, on DBFS paths, or on a Databricks Runtime ML library set. Moving a classic workload means swapping TorchDistributor for @distributed and DBFS paths for Unity Catalog volumes.',
    links: [
      {
        label: 'Migrate classic workloads',
        url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/guides/migrate-classic-workloads',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'Which GPU should I start with?',
    answer:
      '1xA10 (24 GB). Move to 1xH100 (80 GB) when memory is the limit, and to 8xH100 when one GPU is too slow and your code already uses DDP, FSDP, or DeepSpeed. 8xB300 is Public Preview by waitlist, so keep an 8xH100 fallback.',
    links: [
      { label: 'AI Runtime overview', url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/overview' },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does @distributed cost me?',
    answer:
      'It is Beta, runs on one node only, and needs an 8xH100 or 8xB300 accelerator (8xB300 is a Public Preview waitlist), so you pay for 8 GPUs for the whole run. It times out after 3 hours unless you set timeout, and terminating the notebook ends the run. In return, a single-GPU script moves to DDP, FSDP, or DeepSpeed with few code changes. Measure time per epoch against one GPU first.',
    links: [
      {
        label: 'Distributed training',
        url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/distributed-training',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'When do I need multinode instead of @distributed?',
    answer:
      'When 8 GPUs are not enough, or the run outlasts a notebook session. Multinode goes through the AI Runtime CLI or an ai_runtime_task, where each node runs your command (torchrun or accelerate, for example). CLI jobs can run up to 14 days, while notebook jobs and sessions stop at two days.',
    links: [
      {
        label: 'Schedule AI Runtime workloads',
        url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/monitor-deploy/productionizing-training-workloads',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Why can I not use Spark on the GPU node?',
    answer:
      'The migration page for classic workloads says to replace local Spark DataFrame operations with Spark Connect, so Spark does not run on the GPU node. toPandas() pulls a whole table into one machine, which is a poor fit for large tables. The tradeoff is an extra step. Export a large table to Parquet in a Unity Catalog volume from a serverless CPU task, then read that file on the GPU.',
    links: [
      {
        label: 'Load data',
        url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/develop-workloads/dataloading',
      },
    ],
  },
  {
    kind: 'decision',
    question: 'When should I migrate from serverless_gpu to databricks-sdk-air?',
    answer:
      'On GPU environment version 6, now. Version 6 includes both packages and is the last one with serverless_gpu, and the release note says the old names raise a FutureWarning in databricks.air with support ending in version 7. Change the import to databricks.air, gpus to num_accelerators, and gpu_type to accelerator_type. Versions 5 and below keep serverless_gpu.',
    links: [
      {
        label: 'Distributed training and migration',
        url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/connecting/distributed-training',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Is Foundation Model Fine-tuning a better fit than writing my own training loop?',
    answer:
      'It is less code, but you accept the base models and methods the service supports. The release notes show models retired from it over time, so check the current docs before you plan on one. Write your own loop on AI Runtime when you need a custom model, data pipeline, or method.',
  },
  {
    question: 'How do I schedule a GPU training run?',
    answer:
      'Add a notebook task to a job and set the task compute to Serverless GPU with an accelerator, plus an environment version. In a bundle that is compute.hardware_accelerator (Beta in the CLI 1.17 schema) and an environments entry. For a command script on one or more nodes, use an ai_runtime_task (Public Preview). Add a schedule block with a cron expression, and keep max_concurrent_runs at 1.',
    links: [
      {
        label: 'Schedule AI Runtime workloads',
        url: 'https://docs.databricks.com/aws/en/machine-learning/ai-runtime/monitor-deploy/productionizing-training-workloads',
      },
    ],
  },
  {
    question: 'Where do the logs go?',
    answer:
      'To the Logs tab of the MLflow run. Since October 15, 2026 it filters by node, level, and time range, follows a running workload, and lets you download logs. Logs are kept 60 days. For new runs it replaces the log files on the Artifacts tab, which are deprecated.',
  },
  {
    kind: 'tradeoff',
    question: 'What does an AI Runtime run cost, and what stops a runaway one?',
    answer:
      'The docs say you pay only for the compute a workload uses and give no rate in the pages reviewed, so read prices from the Databricks pricing page and your billable usage table. What bounds a run is the accelerator you chose, a job timeout_seconds, max_concurrent_runs of 1, and the service limits of two days for notebook jobs and 14 days for CLI jobs.',
    links: [{ label: 'Databricks pricing', url: 'https://www.databricks.com/product/pricing' }],
  },
];
