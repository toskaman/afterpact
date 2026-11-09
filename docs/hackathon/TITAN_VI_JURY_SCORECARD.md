# TITAN VI — Hostile jury scorecard (simulated, evidence-backed)

Date: 2026-11-09. Six independent reviewer agents inspected the `titan-vi`
branch at `99abed4a` (read-only, file bodies opened, line-level refs).
These are INTERNAL simulated scores, not official predictions. Every score
below is the reviewers' as-simulated verdict; agent-fixable findings were
fixed AFTER the sim (commit `56a541cf`) and are marked FIXED with the new
evidence — the scores themselves are not retro-edited.

## Criterion scores

| Criterion | Score | Basis |
|---|---:|---|
| Technological Implementation | 7/10 | min(architect 7, fintech 8, AI 7) — weakest-link rule. Deterministic policy/idempotency/AI-gate core proven by chaos+unit tests; live-money + restart-durability + metrics-honesty gaps cap it. |
| Design | 6/10 | Guided judge path + real a11y baseline + mobile-first CSS/e2e, but Studio tab markup + silent route changes + unstyled lifecycle strip read as unfinished at sim time. |
| Potential Impact | 4/10 | Buyable pilot + honest touchpoint framing, but sessions=0/pilots=0/interviews=0 and all-ASSUMPTION ROI: a well-structured hypothesis with zero market contact. |
| Innovation / Idea | 7/10 | Cited 13-stage captured-payment-tail gap vs 15+ entries with conceded snippet-only limits; compositional, not primitive-level novelty. |
| Presentation | 6/10 | Rigorous 165 s film QA + honest ledger, but TBD YouTube URL = unsubmittable today and Studio trial unconsented. 8/10 once YouTube + consent-or-fallback resolve. |
| **TOTAL** | **30/50** | |

## Per-reviewer verdicts (condensed)

- **Architect (TechImpl 7):** policy engine pure + tested, idempotency-first
  with chaos proof, webhooks verify→dedupe→route, hold scenario asserts the
  real verdict. Caps: live path half-proven, crash-unsafe persistence,
  auto-known merchants, validUntil rebind, single-process bounds.
- **Fintech (payments 8):** idempotency-before-gates, exact webhook refund
  amounts (incl. TITAN VI $5.00 fix), amountless-response handling,
  defense-in-depth live gating. Caps: in-memory safety state, local-amount
  trust on capture, unguarded status-refresh writes, webhook path skips
  bounds validation, receipts-2 unpinned (FIXED: pinned in
  `paypal.receipts.test.ts`).
- **AI safety (AI 7):** identity-checked provider, refuse-never-clamp gates,
  provenance discipline, repair retry. Caps: METRICS_SUMMARY latencies wrong
  on 4 rows (FIXED: generated from reports + `metrics-summary.test.ts`),
  baseline ambiguities rig (FIXED: 9/15→12/15 as-shipped + artifacts regen),
  README F1 narrative (FIXED), scenario counts (FIXED: 22/16/11/4),
  117/120 suite-mixing (FIXED: caveat added), dead `offer-evaluation` id
  (FIXED: removed), studioAgent comment (FIXED + test-pinned).
- **Designer (Design 6):** one-screen guided path, real a11y baseline,
  mobile-first + 390px keyboard e2e. Caps: Studio tab markup (FIXED),
  route focus (FIXED: focus #main + aria-label + e2e assertion), lifecycle
  styling + scroll-margin (FIXED), CTA link→button (FIXED + e2e roles),
  stale screenshot (FIXED: re-shot 4-card keyless, visually verified).
- **Buyer (Impact 4):** pilot proposal buyable, touchpoint/integrity framing
  honest, positioning consult-grade. Caps: zero sessions/pilots/interviews,
  ROI all-assumption, manual baseline unmeasured. Only fix: run the pack
  (OWNER ACTION).
- **Judge/sponsor (Innovation 7, Presentation 6):** cited-gap positioning,
  rigorous film QA, honest ledger. Caps: TBD YouTube + unsubmitted Devpost
  (OWNER ACTION), Studio consent unsent + history bytes (OWNER ACTION),
  no keyed custom-tools trace (OWNER ACTION: needs inference key).

## What could still cause rejection

(a) Deadline with TBD YouTube / unsubmitted Devpost. (b) AG Grid consent
decline forcing last-minute fallback. (c) "Proven ROI" reading of zero-user
Impact. (d) Judge probing restart survival or demanding a live
capture/refund receipt. (e) Spot-checking metrics (FIXED) or opening Studio
tabs on keyboard/mobile (FIXED).

## Five highest-value remaining actions

1. Upload film to public YouTube + paste URL + SUBMIT (owner).
2. Send AG consent AND install key / flip Community fallback (owner).
3. Run ONE external usability session from the pack (owner + agent docs).
4. Persist idempotency + webhook transmissions; one live-sandbox receipt
   (post-submit engineering; explicitly deferred pre-deadline as too
   invasive — documented, not hidden).
5. Keyed Studio custom-tools trace once a key exists (owner + agent).
