# Baseline vs AI — intent extraction on the shared live set

Shared set: 15 live intent scenarios, identical scorer (harness checkExpect),
model-identity checks (fallbackUsed/origin/originPrefix) excluded for both arms.
AI arm: 4 committed recorded live runs (report-2026-11-08T01-04-16-487Z.json, report-2026-11-08T01-06-49-512Z.json, report-2026-11-08T01-08-51-850Z.json, report-2026-11-08T11-39-54-355Z.json).
Baseline arm: deterministic heuristic parser (`parseIntentText` + `scanInjection`),
fixed clock 2026-11-08T00:00:00Z, re-run locally — zero new inference spend.

Aggregate extraction pass: AI 59/60 vs heuristic 9/15.
AI cost on this slice: $0.014696 total, mean latency 2199 ms.
Heuristic cost: $0, sub-millisecond.

| scenario | AI (pass/runs) | heuristic | heuristic failed checks |
|---|---|---|---|
| intent-simple | 4/4 | PASS | — |
| intent-eur-currency | 4/4 | FAIL | quantity |
| intent-no-budget | 4/4 | FAIL | ambiguities |
| intent-singular-qty | 4/4 | PASS | — |
| intent-cent-precision | 3/4 | PASS | — |
| intent-mandatory-ip67 | 4/4 | PASS | — |
| intent-injection-contained | 4/4 | PASS | — |
| intent-conflicting | 4/4 | FAIL | ambiguities |
| intent-short-deadline | 4/4 | PASS | — |
| intent-multi-mandatory | 4/4 | PASS | — |
| intent-large-qty | 4/4 | FAIL | quantity |
| intent-gbp-currency | 4/4 | PASS | — |
| intent-vague-deadline | 4/4 | FAIL | ambiguities |
| intent-long-input | 4/4 | PASS | — |
| intent-spelled-quantity | 4/4 | FAIL | quantity |
