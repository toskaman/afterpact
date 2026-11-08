# AI eval failure analysis — 87/90 → 117/120 (TITAN III §5.1)

Method: inspected the 3 failing outcomes across the committed live runs,
traced each to the prompt/schema/eval layer, fixed only justified product
causes (no retroactive redefinition of success), added offline regression
tests, re-ran the identical 30-scenario set keyed.

## F1 — `intent-cent-precision` (run 01:04, pass in runs 01:06/01:08)

- Observed: model returned `currency: null` + ambiguity note
  ("'$' may imply USD but is not explicit") where the fixture expects USD.
- Root cause: **transient model flake against an explicit prompt rule**
  (`INTENT_OUTPUT_FIELDS`: "$=USD, €=EUR, £=GBP"). The rule predates the
  runs (commit `a60c40d`); the model obeyed it 2/3 times. The eval
  expectation is correct — no fixture change.
- Fix: none to product (prompt already states the rule); re-run to
  measure. Run 4 (11:39): PASS, no fallback. Documented as known flake.

## F2 — `incident-quality-note-no-gap` (run 01:04)

- Observed: `fallbackUsed: true`, "output was not valid JSON" after 2
  attempts. Deterministic fallback still produced the correct category
  (`other` check passed) — user-visible behavior was right; only the
  live-origin expectation failed.
- Root cause: model emitted unparseable bytes twice; `extractJson`
  (full-parse then first-`{`/last-`}` slice) correctly rejected them.
  Raw output was NOT preserved in the report — diagnosability gap.
- Fix: `outputHead` (first 300 chars of last raw output) now flows
  provider → `AIInvalidOutputError` → fallback provenance → eval
  outcome. Offline regression tests (stubbed fetch, no key needed):
  `tests/unit/ai-provider.test.ts` ("preserves the raw output head…",
  "carries the raw output head…").

## F3 — `incident-insufficient-evidence` (run 01:06)

- Observed: `fallbackUsed: true`, "missingInfo: expected array, received
  string" after 2 attempts. Same correct-fallback situation as F2.
- Root cause: known model tic — lone string where the schema wants
  `string[]`. Strict rejection was safe but wasteful (2 paid attempts →
  fallback on a recoverable shape).
- Fix: `looseStringArray` zod preprocessor in `apps/api/src/aiTasks.ts`
  coerces exactly string→[string] on all 8 string-array fields
  (provider validates with these schemas, so the live path is fixed).
  Non-strings still reject → fallback. Regression tests in
  `tests/unit/ai-tasks.test.ts` ("coerces a lone string…",
  "still rejects non-string array items…").

## Re-run (identical set, 2026-11-08T11:39Z)

30/30, modelSuccess 30/30, citationPrecision 1.000, $0.008933, p50
1550 ms. All three previously failing scenarios pass live with no
fallback. Combined evidence: **117/120 across 4 keyed runs, $0.048225**.
Old reports kept verbatim for comparison.
