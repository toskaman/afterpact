# AFTERPACT internal jury self-score (2026-11-08)

Internal scoring against the five official criteria. Scores are evidence-based
and deliberately strict; they are NOT official results. See
`docs/audit/100_QUESTIONS.md` (114 questions: 97 PASS / 14 PARTIAL / 2 FAIL /
1 UNKNOWN after the OMEGA II live-artifacts pass) for the underlying audit.

| Criterion | Score | Evidence | Deductions |
|---|---:|---|---|
| Technological Implementation | 8/10 | Real PayPal sandbox full-loop (order/capture/refund IDs, receipts artifact re-verified 2026-11-08); real Vultr inference with identity checks; deterministic policy gates; 255 unit/integration tests + 53-scenario AI eval + 5 Playwright E2E, all green in CI; Newman 37/37 | −1 single-node JSON store, no chaos suite; −1 demo state shared across visitors (no per-session isolation) |
| Design | 8/10 | 10 coherent views incl. Outcome Twin and real Studio canvas; dark/light, responsive, focus states, reduced-motion; origin badges on every surface | −1 no usability session (Q84 FAIL); −1 Studio canvas uses default theme (no dark-mode token match) |
| Potential Impact | 7/10 | Crisp persona (merchant-ops refund queue); controlled self-test (8 manual touchpoints vs 3 assisted decisions, measured); honest hypotheses, no invented savings | −2 no interviews, no measured human timings; −1 time estimates only |
| Innovation | 8/10 | Post-payment outcome assurance as a platform: structured promises + verified outcomes + evidence-grounded AI + deterministic gates + human-authorized PayPal refunds + tamper-evident trail + agent-built analytics | −1 competitors now show agentic analytics too (differentiation is the combination, not each part); −1 no outcome-verification moat data yet |
| Presentation | 6/10 | Hosted demo live (TLS, one-click flagship); 13 screenshots; complete Devpost draft; demo script with shot list; docs coherent | −4 VIDEO MISSING (owner step, required by the rules) |

Total: **37/50**.

## What flips the score before submission

1. Owner records + publishes the <3-min video → Presentation 6 → 8/9.
2. One usability session with an outsider (30 min, scripted tasks) →
   Design +1, Impact +1, clears Q84.
3. Trial licence key installed + redeploy (watermark gone) → strengthens
   the sponsor slice inside Technological Implementation.
4. Trial key dates confirmed to cover Dec 1–15 → clears Q112, de-risks Q111.
