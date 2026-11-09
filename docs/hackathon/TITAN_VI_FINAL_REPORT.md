# TITAN VI — Final report (trust & outcome assurance)

Mission: transform AFTERPACT into a demonstrably reliable, judge-ready
outcome-assurance platform. Standard: every important claim reproducible,
every financial decision safe, every demonstrated outcome evidenced.

## 1. Executive status

- Starting SHA (`main`): `5e78098` (CI #59 green).
- Branch: `titan-vi` (8 commits, no force-push, no history rewrite).
- Final code SHA: `56a541c` (CI run
  [#42619291765](https://github.com/toskaman/afterpact/actions/runs/42619291765):
  verify ✓ 317/33, e2e ✓ 12/12, drift ✗-only-stale-manifest).
- Manifest commit: this report's commit (docs-only; lineage rule holds).
- Deployment SHA: `c4299fa` (live, keyless, mock-simulated). Redeploy of
  TITAN VI: DECIDED at merge — backup → deploy → verify, same TITAN V
  procedure (see §9 + `JUDGE_WINDOW_OPS.md`).
- Completion: 2026-11-09 (Europe/Paris). Overall: READY WITH EXTERNAL
  OWNER ACTIONS (submit/YouTube/consent/usability remain owner-side).

## 2. Implemented work

**Phase 0 recon (workflow, 7 agents read-only):** verified HEAD/tree/CI,
mapped every doc-claim mismatch, Judge/data-surface/AG-AI coverage, and
produced the prioritized fix list. No writes.

**A — Submission truth:** drift gate v2 (`scripts/drift-lib.mjs`, pure +
unit-tested validators: manifest-driven numeric checks, wording checks
for live-mode/isolation/usability/mock-as-live/Studio/video/Devpost,
git-lineage rule verifiedCommit∈ancestors(HEAD)+docs-only) with
`--check` semantics preserved; `tests/unit/drift.test.ts` (15 tests,
incl. 2 validator bugs caught TDD-style); reconciled README/DEVPOST/
JURY/CHECKLIST to observed 317/33 + 12/12; fixed DEVPOST live-money
wording to the gated truth; JURY loop-2 + film rows + manifest-run
pointer; `TITAN_VI_STATE.md`, `TITAN_VI_EVIDENCE_LEDGER.md` (40 claims),
`POST_SUBMISSION_CHANGELOG.md` skeleton. User impact: zero contradictions
a judge can spot between docs. Security: wording tripwires fail CI.

**B — Judge Mode:** new `hold` scenario (`runHold`: no approval → real
policy Hold verdict asserted + order refused + stored promise re-read
with `orderIds []`; fails loudly if the verdict isn't Hold) with
`demo.hold.test.ts`; 4 cards (Recover/Hold/Refuse/Proof) + 1-minute
onboarding strip; `judge.e2e.ts` 3→5 tests (Hold incl. API re-read,
mobile 390px + keyboard). All frontend/backend paths existing; no
financial-path change.

**C — Isolation:** honest fallback (documented, drift-enforced). Full
per-session isolation re-estimated as too invasive 3 days pre-deadline
(15 collections + audit scoping + migration). Delivered instead:
`SESSION_ISOLATION_REPORT.md` §6, 25-burst as committed CI test
(`demo.concurrency.test.ts`), drift ban on isolation wording.

**D — AG Studio:** custom `outcome-risk-analyst` agent (`directLlmRunner`,
verified API incl. `defineAiTool`, setup-form harness with
promptStarters) + 3 read-only custom tools over live datasets
(`ag-studio-risk-tools.js`: GET-only allowlisted endpoint, row caps,
status allowlist, abort forwarding, fail-closed) with 7 hermetic unit
tests + keyless e2e harness-marker assertion (proven against the real
3.1.0 bundle) + contract tokens + `AG_GRID_AGENT_DEMO.md` + status
updates. Fallback to base harness if any API is missing (never
half-wired). Trial posture unchanged: key none, consent drafted-not-sent,
judging window UNKNOWN, Nov 11 EOD fallback cutoff.

**E — Impact (no fabrication):** facilitation pack (30-min script +
consent + timing/error sheets), ROI calculator (10 labeled inputs,
formulas, worked example flagged illustration-only), 2-week pilot
proposal (scope, success/stop criteria, data/rollback). Zero sessions
run — stated everywhere.

**F — Safety:** real bug found by inspection → RED → fixed: provider-
initiated partial refunds recorded the FULL capture amount; now the
exact verified-webhook amount (`wireToMoney`) with regression test.
Verified by reading (previously unopened): webhooks verify→dedupe→route,
mock HMAC, live verify-API call, kill-switch placement + webhook-path
design, eval harness checker mechanics + dual gating, baseline test.
`npm audit --omit=dev`: 0 vulns. Secret scan: clean (APIS.txt/.env
ignored). Hermetic test envs (keyed-shell failures fixed).

**G — Presentation/competitive:** OmegaCommerce addendum (closest AG
Grid rival, Devpost 200 fetched: settlement ledger, no assurance tail)
+ lifecycle-table row; judge screenshot re-shot (4-card, keyless,
visually verified); English pass on new strings.

**H+I — Submission/ops:** changelog skeleton, judge-window runbook
(5-min check, backup/restart/rollback, judging don'ts), freeze inputs
(video hash path, snapshot fields).

**J — Jury sim (workflow, 7 agents):** 30/50 as-simulated (7+6+4+7+6);
agent-fixable findings fixed the same day (commit `56a541c`): Studio
tab `>`, lifecycle CSS, scroll-margin, route focus, CTA button, metrics
table generated (4 latency rows corrected), baseline as-shipped 12/15,
eval README counts/F1/caveat, receipts-2 pinned, dead task id removed,
tool-kind doc truth. Scorecard kept as-simulated (not retro-edited).

## 3. Test evidence (observed, keyless)

- Vitest: **317 passed / 0 failed / 33 skipped** (350 total, 39 files) —
  local AND CI
  ([#42619291765](https://github.com/toskaman/afterpact/actions/runs/42619291765)
  verify job) identical.
- Playwright: **12/12** local AND CI (e2e job).
- Typecheck: 6/6 projects exit 0; `node --check` app.js + risk-tools OK;
  build + compiled-server smoke OK (CI verify).
- Newman: 37/37 + 18/18 (artifact unchanged; routes compatible).
- Drift: green locally post-regen; CI drift green expected on the
  manifest commit (docs-only).
- Security: `npm audit --omit=dev` 0 vulns; secret scan clean.
- Spend: 1 incidental keyed probe call at baseline (~$0.0001); all other
  runs keyless; no eval re-runs, no new infra.

## 4. Evidence system

- Manifest regenerated at code SHA with CI-run evidence (317/0/33,
  12/12); lineage rule enforced mechanically from now on.
- Ledger: 40 claims mapped (25 VERIFIED, honest PARTIAL/NOT DONE/OWNER
  ACTION remainder).
- Drift v2: numeric + wording + lineage validators, 15 unit tests.
- Known stale: none in governed docs. Remaining unverified: keyed Studio
  custom-tools trace, usability sessions, judging-window Studio coverage
  (all owner-gated, all labeled).

## 5. Product readiness

- Judge Mode: READY (4 outcomes real, 5 e2e, mobile/keyboard).
- PayPal: Sandbox READY (2 loops pinned); live NEVER executed (gated).
- AI: READY as propose-only with gates; metrics now cheat-proofed;
  recall NOT measured (labeled).
- AG Grid: Community + Studio + custom agent READY; license posture
  PENDING (owner).
- Isolation: shared-demo limitation DOCUMENTED (no false claim).
- User validation: protocol READY, sessions NOT DONE (owner).
- Deployment: `c4299fa` live; TITAN VI redeploy at merge with backup.

## 6. Jury review (simulated 30/50 — see scorecard for detail)

TechImpl 7 (proven core, live/restart caps) · Design 6 (guided path,
craft gaps since fixed) · Impact 4 (zero users — only owner action
fixes) · Innovation 7 (cited tail gap, compositional) · Presentation 6
(rigorous film, unsubmittable until YouTube URL exists; 8 once
resolved). Confidence HIGH (line-level file evidence). Rejection risks:
(a) deadline without submit, (b) consent decline, (c) zero-user Impact
reading, (d) restart/live probes, (e) metrics spot-checks (fixed).

## 7. Owner-only actions

1. **YouTube upload**: upload
   `brag-output/paypal-ai-2026/AFTERPACT_PAYPAL_AI_FINAL.mp4` as Public
   (+ `.srt`), per `DEVPOST_YOUTUBE_METADATA.md`. Blocks submission.
   Return the URL.
2. **Devpost submit**: paste URL + `DEVPOST_DRAFT.md` fields at
   `https://paypalaihackathon.devpost.com/` before Nov 12, 21:00 Paris.
   Blocks everything. Return receipt/timestamp.
3. **AG Grid consent + key**: send `ag-studio-trial.md` draft to AG Grid
   before Nov 11 EOD; on reply install `AG_STUDIO_LICENSE_KEY` or confirm
   fallback to `AG_STUDIO_DISABLED=1`. Blocks sponsor prize posture.
4. **Usability session**: run `USABILITY_FACILITATION_PACK.md` with ≥1
   external ops/support person (30 min), return raw notes. Unblocks
   Impact evidence.
5. **Vultr upkeep**: keep the demo live through Dec 15 (see
   `JUDGE_WINDOW_OPS.md`). Blocks judging.
6. **Keyed Studio trace (optional, post-key)**: with an inference key,
   run the "Outcome risk briefing" starter, capture trace. Strengthens
   sponsor story.
7. **Confirm merge+deploy** (or delegate standing authorization): merge
   `titan-vi` → `main`, redeploy, record SHAs.

## 8. Remaining priorities (ranked)

1. Owner submit + YouTube (disqualification-adjacent).
2. Owner consent-or-fallback (sponsor/legal).
3. Owner usability session (Impact).
4. Post-submit: persist idempotency + webhook transmissions; one live
   CI-gated receipt (deferred pre-deadline: invasive, documented).
5. Post-key: Studio custom-tools trace; then n>1 sessions + pilot.

## 9. Rollback and preservation

- Last-known-good `main`: `5e78098` (CI #59 green). TITAN VI branch:
  `titan-vi` (8 commits, linear, no rewrites).
- Last-known-good deploy: `c4299fa` + backup
  `/root/afterpact-backup-20261109-c4299fa.tgz` (sha `7d2986f8…e6485`).
- Recovery: merge → backup → deploy → verify (§7.5-min check); on
  failure restore backup + prior build, record in changelog.
- Deferred (documented, not hidden): per-session isolation, SQLite
  migration, durable idempotency/dedupe, merchant-ownership
  enforcement, validUntil-rebind semantics, provider-amount equality,
  unguarded status-refresh writes, live capture/refund CI tripwire,
  keyed Studio trace, all human validation.
