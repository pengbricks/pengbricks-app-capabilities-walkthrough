# AI Functions in SQL

## Overview

One serverless job runs AI Functions over small sample tables and scores every output against the answer a person would give. It triages support tickets, pulls fields out of invoice PDFs, masks personal details in call notes, matches company names across two lists, translates reviews with `ai_query`, and forecasts daily orders. The last task reads who can call the functions and what they have cost. Job key: `capability_guides_ai_functions`.

All sample data is in `use_cases/general.yml`. The names, emails, and phone numbers are made up (555-01xx numbers, example.com addresses). The invoice PDFs are rendered at run time with fpdf2.

## What this shows

| Step | Functions | Result in the reference run |
|---|---|---|
| Triage 24 tickets | `ai_classify`, `ai_analyze_sentiment`, `ai_summarize` | Category 24 of 24 correct. Sentiment 20 of 24: three neutral requests read as negative or positive, and one praise-plus-request read as mixed. |
| Decide on 24 tickets | `ai_decide` (Beta) | Not run: the AI Decide preview is off in the reference workspace. The step records the error and the job continues. With the preview on, it scores the service-down probability against tickets 7 to 11. |
| Extract 6 invoice PDFs | `ai_parse_document`, `ai_extract` | All 6 parsed; number, vendor, date, and total correct on every invoice (24 of 24 fields). |
| Mask 6 call notes | `ai_mask` | 15 planted names, emails, and phone numbers; none left in the output. |
| Match 8 accounts to 8 vendors | `ai_similarity` | 30 pairs scored within country. At 0.85: 5 of 6 true matches, no false ones. |
| Translate 5 reviews to Japanese | `ai_query` with `databricks-meta-llama-3-3-70b-instruct` | 5 of 5 translated, no errors. |
| Forecast daily orders | `ai_forecast` | Backtest on September 2026: mean absolute percentage error 0.72% (east) and 0.78% (west); 60 forecast rows to 2026-10-31. |
| Check access and usage | `SHOW GRANTS`, `system.billing.usage` | `account users` holds EXECUTE on `system.ai`. Usage is read for the whole account, not just this job. |

Each step writes its scores to `aif_results`, replacing its own rows.

## What the runs taught

- **A VARIANT null is not SQL NULL.** `WHERE doc:error_status IS NULL` dropped every parsed PDF, because `ai_parse_document` returns a VARIANT and a JSON null inside it is a value. Count the errors instead: `coalesce(array_size(try_variant_get(doc, '$.error_status', 'ARRAY<VARIANT>')), 0) = 0`, which also handles a missing field and an empty array.
- **Not every pay-per-token endpoint accepts batch calls.** `databricks-claude-haiku-5-5` and `databricks-claude-sonnet-5-5` returned "not supported for batch inference". Llama 3.3 70B, GPT OSS 120B, Claude Sonnet 4.6, and GPT-5 mini worked.
- **`failOnError => false` returns `result` and `errorMessage`.** Read `r.result`, not `r.response`.
- **`ai_forecast` needs a SQL warehouse here.** Serverless notebook compute rejected it as a disabled preview, so `06_forecast` is a SQL notebook task on the warehouse.
- **Some functions need a preview switched on.** `ai_decide` failed with "AI Decide Preview is not enabled. A workspace admin must enable it in workspace preview settings." `ai_predict_class` and `ai_predict_value` need the Predictive AI Functions preview.
- **Similarity has no clean cutoff.** The true pair Adventure Works Cycles / Adventure Works scored 0.783; the wrong pair Proseware Health / Proseware Logistics scored 0.797. Review a middle band by hand.

## Architecture

```mermaid
flowchart LR
  spec[use_cases/general.yml] --> land[01_land_samples]
  land --> triage[02_triage_tickets]
  land --> extract[03_extract_invoices]
  land --> mask[04_mask_and_match]
  land --> translate[05_translate]
  land --> forecast[06_forecast on SQL warehouse]
  triage & extract & mask & translate & forecast --> access[07_usage_and_access]
  triage & extract & mask & translate & forecast --> results[(aif_results)]
```

## Reference code

- `use_cases/general.yml`: every sample, label set, extraction schema, threshold, and the `ai_query` endpoint
- `guides/ai-functions/00_start_here`: what the guide shows, the variables, links to the job
- `guides/ai-functions/02_triage_tickets` to `06_forecast`: one AI Functions query per notebook, then the scoring
- `src/aif_lib.py`: spec checks, invoice PDFs, scoring (`accuracy`, `leaked`, `match_scores`), and `write_results`
- `resources/ai_functions.job.yml`: the seven-task job; `forecast` sets `warehouse_id`

## Demo steps

1. Open `use_cases/general.yml` and point out the expected answers next to each sample.
2. Open the latest `capability-guides-ai-functions` run. Steps 2 to 6 ran in parallel.
3. Query the scores:
   ```sql
   SELECT step, metric, round(value, 4) AS value, detail FROM <catalog>.<schema>.aif_results ORDER BY step, metric;
   ```
4. Open `aif_invoices_extracted` next to one PDF in the `aif_documents` volume.
5. Open `aif_call_notes_masked` and search for any planted value.
6. Open `aif_account_vendor_scores` sorted by score and find the two pairs around 0.78 to 0.80.

## Limitations

- The samples are small on purpose. Accuracy on 24 tickets says the setup works, not how a model does on your data. Label a few hundred of your own rows before you rely on a function.
- `07_usage_and_access` reads grants and does not change them. Revoking EXECUTE on `system.ai` affects every user in the metastore.
- Usage lands in `system.billing.usage` hours after a call, so a run's own calls may not appear yet.
- Function-level permissions are in Public Preview and turned on through the account team; this guide does not use them.
