# AI Functions for data quality

## Overview

A folder of notebooks runs five data quality checks on 300 made-up order records, rules first and AI Functions only on the rows the rules cannot judge. Results from both land in one table, `aidq_quality_results`, with a quarantine table for failed and doubtful records. The last notebook scores every check against a labelled answer key and estimates cost. The same notebooks run as one serverless Lakeflow Job; job key: `capability_guides_ai_functions_data_quality`.

The walkthrough covers when AI beats rules, the five patterns, running them in a pipeline, accuracy, cost, and governance. This folder is the run behind it. For the functions one by one, see the AI Functions in SQL guide, and for rule-based checks and quarantine, the Data validation framework guide, both in the same bundle family.

| Check | Rule | AI Function on the residue |
|---|---|---|
| `reason_code` | One keyword set matches the text | `ai_classify` (version 2.1, confidence scores) |
| `address` | Canonical `street, city, ST zip` pattern | `ai_extract` (version 2.1) |
| `duplicate_company` | Same normalized name as an earlier record | `ai_similarity` over blocked pairs |
| `sensitive_note` | Email, phone, and SSN patterns | `ai_mask` |
| `status_comment` | No comment, nothing to contradict | `ai_query` with `responseFormat` and `failOnError => false` |

The data is generated from a fixed seed (`use_cases/data_quality.yml`, `src/aidq_lib.py`). Names, emails, and phone numbers are made up. The answer key is `aidq_truth`, and no AI call reads it.

## Run it

- **By hand:** open the `guides/ai-functions-data-quality` folder, read `00_start_here`, then Run all in `01_messy_sample` and each notebook after it, in order. Widgets fill from the deployed job.
- **As a job:** run `capability-guides-ai-functions-data-quality`, or Quick run in the app.
- **Compute:** serverless notebook compute, as the other jobs in the `ai-functions` bundle. No SQL warehouse is needed. A Pro or serverless SQL warehouse also runs these functions if you attach one by hand. Classic SQL warehouses do not.
- **Billing lags.** `04_accuracy_and_cost` polls `system.billing.usage` for a few minutes and records `billing_status` as `complete`, `partial`, or `not_available`. Run it again later if it is not `complete`.
- **Safe to rerun:** every table is replaced, never appended, so row counts stay the same. Model answers can vary between runs, so scores can move a little.
- **Cost while idle:** none. The guide creates tables only. Drop the `aidq_` tables to remove it.

## Required setup

- AI Functions available in the workspace region (`ai_classify` and `ai_extract` version 2.1 are not offered in every region), or cross-Geo processing enabled by an admin.
- Partner-powered AI features: the setting does not list AI Functions, so the job should not need it. It defaults to off with the compliance security profile and is slated for removal on November 1, 2026. Ask your account team if a function reports it.
- An `ai_query` endpoint that serves batch calls and structured output. The spec names `databricks-meta-llama-3-3-70b-instruct`; change `endpoint` if your workspace serves something else.
- Read access to `system.billing` for the cost notebook. Without it the cost lines record -1.

## Reference run

No recorded run yet. After a deploy and run, the table below is filled from `aidq_results`.

| Check | Rule precision / recall | AI precision / recall | Review share |
|---|---|---|---|
| `reason_code` | | | |
| `address` | | | |
| `duplicate_company` | | | |
| `sensitive_note` | | | |
| `status_comment` | | | |
