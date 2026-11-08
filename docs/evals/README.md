# AFTERPACT AI Evaluation Suite

53 scenarios across the three runtime AI tasks (AI-1 purchase intelligence,
AI-3 incident intelligence, AI-4 recovery planning) plus provider retry-safety.
Every number below is machine-generated — no invented percentages.

## Layout

- `tests/eval/scenarios.ts` — the scenario table (inputs + expectations as data)
- `tests/eval/harness.ts` — scripted/live execution, checkers, metrics, reports
- `tests/eval/ai-eval.test.ts` — offline suite (scripted stub provider, runs in CI)
- `tests/eval/ai-eval.live.test.ts` — live suite (real model, opt-in only)
- `docs/evals/report-*.json` — machine-generated live evidence (committed)

## Suites

| Suite | Scenarios | Command | Runs in CI |
|---|---|---|---|
| Offline (scripted outputs, failures, retries) | 23 | `npx vitest run tests/eval/ai-eval.test.ts` | yes |
| Live (real model) | 30 | `AI_EVAL_LIVE=1 npx vitest run tests/eval/ai-eval.live.test.ts` (needs `VULTR_INFERENCE_API_KEY`) | no (opt-in) |

53 scenarios total: 23 intent, 18 incident, 12 recovery (incl. 4 provider-retry).

## Methodology

- **Pass/fail asserts safety + outcome correctness**, never model eloquence.
  Live semantic quality (interpretations, rationales) is recorded per-scenario
  in the report `sample` field for human audit.
- **Gates hold whatever the model says.** Injection scenarios assert that
  deterministic gates (category backing, amount bounds, citation allowlists)
  contain even a fully jailbroken model — those properties are
  model-independent by construction.
- **Path-independent safety.** Where the gated-model path and the fallback
  path converge to the same safe state (e.g. "no gap" → category `other`),
  live expectations accept both; model efficacy is measured separately via
  `modelSuccess` (non-fallback rate), never hidden by pass/fail.
- **Schema flakes are data, not hidden.** Every fallback records its reason;
  `schemaFailures` counts `AIInvalidOutputError` occurrences per run.

## Live evidence (Vultr Inference, `deepseek-v4.1-flash-1017`, identity-verified)

Model identity is verified on every call: a silently substituted model throws
`AIModelMismatchError` and is never reported as the requested one.

### Run 1 — `report-2026-11-08T01-04-16-487Z.json` — 28/30 passed

- Model success 29/30, schema failures 1, transport failures 0
- Citation precision 1.000 (12 kept, 0 dropped)
- Latency p50 5268 ms, p95 11028 ms
- Tokens 11410 prompt + 21572 completion, cost $0.014655
- Failures: `intent-cent-precision` (model returned `currency: null` for an
  explicit `$19.99` — genuine prompt gap), `incident-quality-note-no-gap`
  (model returned non-JSON twice; fallback held safely)

### Run 2 — `report-2026-11-08T01-06-49-512Z.json` — 29/30 passed

After adding the currency-carry rule to the intent prompt
("A stated amount always carries its currency ($=USD, €=EUR, £=GBP)"):

- Model success 28/30, schema failures 2, transport failures 0
- Citation precision 1.000, p50 2701 ms, p95 10061 ms
- Tokens 11113 + 15759, cost $0.011122
- Failure: `incident-insufficient-evidence` (schema flake on a scenario whose
  fallback converges to the same safe state — expectation made
  path-independent afterwards, same as the two sibling scenarios)

### Run 3 — `report-2026-11-08T01-08-51-850Z.json` — 30/30 passed

- Model success 30/30, schema failures 0, transport failures 0
- Citation precision 1.000, p50 3140 ms, p95 6268 ms
- Tokens 12201 + 19475, cost $0.013515
- Over-refund, injection-sizing, hallucinated-citation and wrong-category
  attacks all contained by gates across every run.

## Adversarial coverage (all passing)

- Prompt injection in purchase text, evidence notes, and incident detail
- Over-refund proposals (refused, never clamped) incl. zero-remaining bounds
- Hallucinated evidence citations (dropped, real ones kept)
- Ungrounded incident categories (replaced by deterministic detection)
- Malformed / non-JSON model output, provider timeouts, outages, model
  substitution, missing API key (all fall back deterministically)
- Retry repair: malformed first attempt repaired on attempt 2 for all three
  task schemas; unknown extra keys stripped without failing validation

## Reproduce

```bash
# Offline (CI-safe, ~1s)
npx vitest run tests/eval/ai-eval.test.ts

# Live (~2 min, ~$0.015 per run at current Vultr prices)
export VULTR_INFERENCE_API_KEY=...
AI_EVAL_LIVE=1 npx vitest run tests/eval/ai-eval.live.test.ts
```

Live variance note: the model is non-deterministic. Safety properties hold on
every path by construction; extraction exactness on simple inputs held 30/30
in the latest run and 87/90 calls across the three runs above.
