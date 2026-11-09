# TITAN V — Hostile jury simulation (INTERNAL, simulated — not external validation)

Date: 2026-11-08. HEAD: `47d714d`. Six independent simulated reviewers.
Each score is 0–10 against that reviewer's professional bar, with evidence and
the single highest-impact corrective action. No simulated score predicts real judges.

---

## Reviewer 1 — Senior Software Architect — 8/10

**Strengths.** Coherent monorepo (domain/policy/payments/ai/api), exact
minor-unit money, versioned + hash-chained PurchasePromise, deterministic policy
gates between AI proposals and money movement, append-only Flight Recorder,
atomic JSON snapshot + `.bak` rotation, 288 vitest + 7 e2e + Newman + drift
gate all green with honest keyless skips.

**Critical objections.** (1) Single-node JSON store is the scalability and
crash-consistency ceiling — fine for judging, not for the "control plane"
positioning. (2) No full per-session isolation: global lists/audit views shared,
per-run tokens only. (3) Deployed build (`d1e79f2`) trails HEAD (docs-only drift,
but parity unproven by SHA).

**Missing proof.** Concurrency test at 25 sessions; restore-from-backup drill log.

**Corrective action.** Per-session demo isolation + documented restore drill
before judging (Phase 3) — kills the two biggest architectural objections.

## Reviewer 2 — Fintech / Payments Expert — 8/10

**Strengths.** Real sandbox loop executed and test-pinned (order `2ER…722V` →
capture `7R1…771B` → partial refund `8DJ…303G`, statuses verified); webhook
signature + redelivery handling; idempotency keys; per-capture refund bounds;
kill switch; fail-closed unknowns. Honest SIMULATED vs RECORDED labeling
everywhere, including on film.

**Critical objections.** (1) Public demo runs mock transport — a judge who never
opens the receipts doc sees simulation only. (2) Single capture/refund pair in
sandbox evidence; no multi-currency or dispute/chargeback path shown. (3) No
live-money story by design (correct) — but the "verified provider execution"
claim rests on one recorded loop.

**Missing proof.** Second sandbox loop with a different amount/edge case;
webhook live-delivery log excerpt (redacted).

**Corrective action.** Record one more sandbox loop (e.g. full refund or
second partial) and pin it — doubles provider evidence for ~30 min of work.
**DONE 2026-11-08:** full-refund loop `59A94150344824111` → `72S38593LS000452A`
→ `15T12360RX6158212` in `docs/demo/paypal-live-receipts-2.json`.

## Reviewer 3 — AI Research / Safety Expert — 8/10

**Strengths.** Real inference (Vultr `deepseek-v4.1-flash-1017`, identity
verified per call), 53-scenario corpus (30 live + 23 offline) with adversarial
cases (injection, over-refund, hallucinated citations, malformed output),
117/120 scenario passes + 30/30 latest, citation precision 1.000 every run,
AI-vs-heuristic baseline (59/60 vs 9/15) with methodology disclosed, recorded
gallery never labeled live, deterministic gates independent of the model.

**Critical objections.** (1) 117/120 mixes scenario passes and model calls in
casual reading — the reports separate them, the pitch may not. (2) Baseline
compares AI-over-4-runs (60) vs heuristic single-run (15) — disclosed but
asymmetric. (3) No live inference on the public demo: judges can't poke the
model, only replay it.

**Missing proof.** Cost/latency table per task (exists per-call in reports;
needs one summary view); calibration of "confidence" language in proposals.

**Corrective action.** Add a one-page eval summary (metrics × runs table) linked
from the gallery — removes the "single misleading percentage" risk entirely.

## Reviewer 4 — Product Designer — 7/10

**Strengths.** Distinct Signature theme, dark/light, consistent pills and
financial states; Outcome Twin is genuinely memorable (promised/observed/
recovered in one composition); Flight Recorder reads as an investigation
timeline; film is professional (165 s, subs, honest labels); keyboard + focus
+ contrast work done.

**Critical objections.** (1) No 30-second Judge Mode entry — a first-time judge
lands in an ops dashboard, not a story. (2) Several views are dense (timestamps,
hashes, pills compete); progressive disclosure is thin. (3) Mobile works but is
clearly second-class; judges on laptops won't care, phone-checkers will notice.

**Missing proof.** A timed first-run comprehension check with a fresh human
(even n=1); touch-target audit on approval controls.

**Corrective action.** Ship the Judge Mode entry (headline + Run flagship +
3 scenario cards) pre-judging — the single biggest Design-score lever.
**DONE 2026-11-08:** `#/judge` live (frontend-only, 3 e2e green,
`docs/demo/JUDGE_MODE_GUIDE.md`).

## Reviewer 5 — Merchant Operations Buyer — 6/10

**Strengths.** Problem is real and sharply scoped (post-payment exceptions);
buyer persona named with budget areas; ROI math uses explicit labeled
assumptions instead of invented traction; pilot scope is small and sane
(one merchant, one category, human approval, stop conditions); kill switch +
redacted exports answer the trust questions before they're asked.

**Critical objections.** (1) Zero users, zero pilots, zero revenue, zero
interviews — everything commercial is hypothesis. (2) "637 ms" and "28 min"
are machine time and estimate respectively; correctly labeled, but there is
no human number at all. (3) No integration story beyond "API + pilot" —
where does AFTERPACT sit in a real merchant stack (Shopify? NetSuite? Zendesk?)?

**Missing proof.** One recorded operator walkthrough with timings; one named
integration surface (even a read-only webhook receiver design).

**Corrective action.** Run and record one honest usability session (owner,
30 min) — moves Impact from "labeled void" to "small but real evidence".

## Reviewer 6 — Hackathon Judge / Sponsor Reviewer — 7/10

**Strengths.** Rules-shaped submission: public MIT repo, live demo, <3 min
film made from real footage, AI-tools disclosure drafted, PayPal central to
the loop (not bolted on); AG Grid usage is genuine (Community tables +
Studio canvas + agent over live datasets, screenshots + film segment);
claims map to artifacts via manifest + drift gate + evidence ledger.

**Critical objections.** (1) Film exists but is NOT public — the single most
visible missing checkbox. (2) AG Studio trial key + written consent missing;
EULAinternal-evaluation-only vs public demo is a live compliance risk until
the Nov 11 cutoff resolves it either way. (3) Devpost not submitted — nothing
above counts until it is.

**Missing proof.** Public YouTube URL; consent email or fallback commit;
submission receipt.

**Corrective action.** Owner executes the 3-step lock (upload → paste → submit)
before Nov 12 21:00 Paris; agent snapshots the exact submitted revision.

---

## Panel synthesis

Mean simulated score: **7.3/10** (consistent with scorecard 38/50).
Unanimous: the engineering is real and the honesty labeling is a differentiator.
Unanimous: humans (users, upload, submit, consent) are the entire remaining risk.
No reviewer found a fabricated claim; two found labels that could be misread in
pitch form (117/120, 59/60-vs-9/15) — both fixed by pointing at the ledger.
