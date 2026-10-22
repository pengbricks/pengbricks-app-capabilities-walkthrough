# Databricks notebook source
# MAGIC %md
# MAGIC # Genie ZeroOps: break a job and watch it get diagnosed
# MAGIC
# MAGIC Genie ZeroOps is in private preview. This job gives it something to diagnose. `capability-guides-zeroops-demo` builds a sample orders table, then computes daily revenue. Run it healthy first, add it to ZeroOps, then run it with a mistyped column name so the second task fails.
# MAGIC
# MAGIC ## Notebooks, in run order
# MAGIC
# MAGIC | Notebook | Task | What it does |
# MAGIC |---|---|---|
# MAGIC | `01_prepare_data` | `prepare_data` | Replaces `zo_orders` with 500 seeded sample orders. |
# MAGIC | `02_daily_revenue` | `daily_revenue` | Sums `amount_column` per day into `zo_daily_revenue`. Fails on a column that does not exist. |
# MAGIC
# MAGIC ## Required setup
# MAGIC
# MAGIC 1. **ZeroOps enabled in your workspace.** It is a private preview. Ask your Databricks account team to enable it. Nothing here turns it on.
# MAGIC 2. **You own the job.** ZeroOps monitors jobs you own. Deploy the bundle as yourself, then run it as yourself.
# MAGIC 3. **The shared schema.** Deploy the `foundation` bundle first. This job writes `zo_orders` and `zo_daily_revenue` into the `capability_guides` schema (the dev copy in development mode). It creates nothing at account level.
# MAGIC
# MAGIC ## Find the ZeroOps inbox
# MAGIC
# MAGIC ZeroOps has no separate URL. It appears as the ZeroOps inbox inside full-screen Genie Code in an enabled workspace. Two ways in:
# MAGIC
# MAGIC - **Jobs & Pipelines** in the left nav. Once ZeroOps is enabled, a ZeroOps banner at the top opens the inbox.
# MAGIC - **Full-screen Genie Code.** Open `https://<your-workspace-host>/editor/folders/workspace?mode=chat&o=<workspace-id>`, or open Genie Code chat anywhere and click the full-screen button at the top.
# MAGIC
# MAGIC The **Configure** button shows only outside full-screen mode. If you can't find the inbox or Configure, exit full screen.
# MAGIC
# MAGIC The inbox stays empty until a monitored job fails. Add the job with Configure, or ask in the chat: `Monitor the job capability_guides_zeroops_demo`.
# MAGIC
# MAGIC ## The demo
# MAGIC
# MAGIC ```bash
# MAGIC # 1. healthy run
# MAGIC databricks bundle run capability_guides_zeroops_demo --target dev
# MAGIC # 2. add the job to ZeroOps (Configure, or the chat prompt above)
# MAGIC # 3. break it: a mistyped column name
# MAGIC databricks bundle run capability_guides_zeroops_demo --target dev --params amount_column=amout
# MAGIC # 4. wait 1 to 2 minutes, open the inbox, review the root cause, lineage and proposed fix
# MAGIC # 5. reset
# MAGIC databricks bundle run capability_guides_zeroops_demo --target dev
# MAGIC ```
# MAGIC
# MAGIC Use a plain job failure as the trigger. Data-quality triggers such as schema drift or a data spike are less dependable in the preview.
# MAGIC
# MAGIC ## Variables
# MAGIC
# MAGIC | Variable | Meaning |
# MAGIC |---|---|
# MAGIC | `catalog` | Unity Catalog catalog that holds the guide schema. |
# MAGIC | `schema` | Schema for `zo_orders` and `zo_daily_revenue`. |
# MAGIC | `amount_column` | Column that `02` sums. Default `amount`. `amout` is the deliberate break. |
# MAGIC
# MAGIC Every variable is a widget. Leave one blank and it takes the default of the deployed job's parameter with the same name.
# MAGIC
# MAGIC Safe to rerun: this notebook only reads and links the deployed job.
