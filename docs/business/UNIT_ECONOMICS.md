# AFTERPACT — Unit Economics (assumptions)

> All figures are labeled hypotheses. No production traffic, no LLM spend,
> and no customer data exist yet. Recompute from pilot measurements before
> quoting anything externally.

## Cost drivers per incident

| Driver | Assumption | Notes |
|---|---|---|
| Compute (API + store) | negligible at pilot scale | Node + JSON snapshot store (SQLite migration is future work); hosted cost dominated by base tier |
| AI inference | measured: $0.0482 for 120 eval scenarios (~$0.00040/scenario) on Vultr `deepseek-v4.1-flash-1017` | `apps/web/public/gallery/ai-gallery.json` totals; production per-incident cost still unmeasured — pilot must meter it |
| PayPal fees | merchant's existing processing cost | AFTERPACT adds no per-transaction PayPal fee |
| Operator time (with AFTERPACT) | 3–8 min/case vs 15–45 manual | Hypothesis H1; measure in pilot |
| Evidence storage | cents per case | Redacted bundles, retention-tiered |

## Value-side hypotheses

- H1: 60–80% reduction in operator minutes per exception case.
- H2: near-zero duplicate/over-refund leakage via policy gates
  (bounded by captured amount, approval-bound, idempotent).
- H3: evidence completeness → faster merchant response (measure
  response-window days before/after).

## Break-even sketch (illustrative, not a promise)

If a case costs an operator 30 min at €30/h fully loaded (€15/case) and
AFTERPACT cuts it to 5 min (€2.50/case), gross value is ~€12.50/case before
AFTERPACT fees. A usage fee must sit well under that delta while covering
hosting + support. Pilot must measure H1–H3 with the protocol in
`docs/benchmarks/IMPACT_BENCHMARK.md` before any pricing is set.

## What would invalidate the model

- Exception queues smaller than assumed (no willingness to pay).
- Merchants refusing any third-party financial-action tooling.
- PayPal-native resolution covering the same cases with less friction.
- Evidence gathering dominated by unstructured channels we cannot ingest.
