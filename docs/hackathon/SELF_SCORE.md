# AFTERPACT internal jury self-score (2026-11-08)

Internal scoring against the five official criteria. Scores are evidence-based
and deliberately strict; they are NOT official results. See
`docs/audit/100_QUESTIONS.md` (139 questions: 110 PASS / 22 PARTIAL /
5 FAIL / 2 UNKNOWN after the OMEGA II appendix) for the underlying audit.
Full rationale: `docs/hackathon/OMEGA_II_FINAL_REPORT.md` §G.

| Criterion | Score | Evidence | Deductions |
|---|---:|---|---|
| Technological Implementation | 9/10 | B1–B5: licensing-clean Studio, build-SHA, artifact-pinned PayPal/Channel3, gallery, per-run bounds + concurrency 8/8; 267+33 + 6/6 e2e + Newman 37/37+18/18, CI green | −1 single-node JSON store + no chaos suite (sessions bounded, not fully isolated) |
| Design | 9/10 | Signature Studio theme e2e-pinned; Twin DIVERGENCE strip; a11y live regions + tabs; origin badges everywhere | −1 no independent usability session (package ready, Q84/Q127 FAIL) |
| Potential Impact | 8/10 | Merchant enterprise case + 5-scenario study package + labeled ROI sketch; structural 8→3 win measured | −2 no interviews/users, no measured human timings (Q126/Q127 FAIL) |
| Innovation | 9/10 | 13-stage lifecycle evidence table vs 15+ entries; 90-scenario committed eval corpus; captured-payment tail owned | −1 no durable moat proof yet (pilots + data pending) |
| Presentation | 7/10 | Demo live @ HEAD build; Devpost rewritten; recording package exact; gallery + docs coherent | −3 VIDEO FILE MISSING (owner step, Q6/Q134 FAIL) |

Total: **42/50** (was 37; +5 evidenced, nothing forced).

## What flips the score before submission

1. Owner records + publishes the <3-min video → Presentation 7 → 9/10.
2. One usability session with an outsider (30 min, `USABILITY_STUDY.md`) →
   Design +1, Impact +1, clears Q84/Q126/Q127.
3. Trial licence key installed + redeploy (watermark gone) → clears
   Q112/Q117, strengthens the sponsor slice.
4. Consent request sent to AG Grid → clears Q10/Q116 residual.
