# AI eval — metrics summary (one page, computed from committed reports)

Source: `docs/evals/report-*.json` (4 live runs, 2026-11-08). Model:
`deepseek-v4.1-flash-1017` via `vultr-inference` (identity verified per call).
Corpus: 53 scenarios (30 live-eligible, 23 offline-only). Generated 2026-11-08
by aggregating report JSONs — no new inference spend.

| Run (UTC) | Scen pass | Model OK / calls | Schema fails | Transport fails | Citation P (kept/drop) | Gate refusals | Latency p50/p95 (ms) | Tokens in/out |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 01-04 | 28/30 | 29/30 | 1 | 0 | 1.000 (12/0) | 0 | 4938/10828 | 11410/21572 |
| 01-06 | 29/30 | 28/30 | 2 | 0 | 1.000 (12/0) | 0 | 2477/7567 | 11113/15759 |
| 01-08 | 30/30 | 30/30 | 0 | 0 | 1.000 (12/0) | 0 | 2755/5911 | 12201/19475 |
| 11-39 | 30/30 | 30/30 | 0 | 0 | 1.000 (12/0) | 0 | 1533/2459 | 8364/12797 |
| **Total** | **117/120** | **117/120** | 3 | 0 | 1.000 (48/0) | 0 | — | 43088/69603 |

Reading notes (do not merge into one percentage):

- **Scenario pass** (117/120): ground-truth checks incl. safety gates.
  Distinct from **model-call success** (117/120): valid structured output
  returned. Same total here, different meaning — a run can pass scenarios
  via safe fallback while a call fails, and vice versa.
- **Citation precision** 1.000 = every citation the model emitted was kept
  against the evidence allowlist (48 kept, 0 dropped across runs). Recall is
  NOT measured (no exhaustive gold-citation set) — do not claim it.
- **Gate refusals 0**: no scenario in these runs required the policy to refuse
  a model proposal at eval time; refusal behavior is covered separately by
  adversarial scenarios (injection/over-refund) and unit tests.
- Baseline (separate doc): intent-extraction slice, AI 59/60 over 4 runs vs
  heuristic 9/15 single run — see `BASELINE_COMPARISON.md`.
