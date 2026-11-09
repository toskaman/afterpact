# TITAN VI — Evidence Ledger (public claim → artifact)

Date: 2026-11-09. Every public-facing claim maps to an inspectable source.
States: VERIFIED (observed this mission) · PARTIAL (works with a noted gap) ·
UNVERIFIED · NOT DONE · NOT MEASURED · ESTIMATE · OWNER ACTION REQUIRED.

## Test & build claims

| # | Claim | State | Artifact |
|---|---|---|---|
| 1 | Vitest 317 passed / 0 failed / 33 skipped (keyless) | VERIFIED | `npm test` 2026-11-09 branch `titan-vi` (39 files, 350 total); CI `verify` after push |
| 2 | Playwright 12/12 incl. Hold + mobile/keyboard judge tests | VERIFIED | `npx playwright test` 2026-11-09; `tests/e2e/*.e2e.ts` |
| 3 | Strict tsc clean on 6 projects | VERIFIED | `npm run typecheck` exit 0, 2026-11-09 |
| 4 | Newman 37/37 requests, 18/18 assertions | VERIFIED | `postman/newman-report.json` (unchanged; no route shape changed) |
| 5 | Manifest statics match repo; lineage clean | PARTIAL | drift gate green after manifest regen (regen follows branch CI) |
| 6 | Docs-truth gate catches stale counts/wording | VERIFIED | `scripts/drift-lib.mjs` + `tests/unit/drift.test.ts` (15 tests); live run flagged exactly the 10 intended items |

## PayPal claims

| # | Claim | State | Artifact |
|---|---|---|---|
| 7 | Sandbox loop 1 (partial): `2ER387580K033722V`/`7R158417X9367771B`/`8DJ895035B173303G` | VERIFIED | `docs/demo/paypal-live-receipts.json`, test-pinned |
| 8 | Sandbox loop 2 (full): `59A94150344824111`/`72S38593LS000452A`/`15T12360RX6158212` | VERIFIED | `docs/demo/paypal-live-receipts-2.json`, test-pinned |
| 9 | Hosted demo runs mock transport, keyless | VERIFIED | `/api/config` on `c4299fa` deploy; `JUDGE_MODE_GUIDE.md` boundaries |
| 10 | Live mode gated (`PAYPAL_MODE=live` + `PAYPAL_ALLOW_LIVE=true`), never executed live | VERIFIED | README safeguards + `paypal.safety.test.ts` live-gate tests |
| 11 | No duplicate capture/refund; idempotent; kill-switch fail-closed | VERIFIED | `paypal.chaos/safety/flows.test.ts` (25-seq + 20-parallel same-key, racing refunds, redelivery ×5) |

## AI claims

| # | Claim | State | Artifact |
|---|---|---|---|
| 12 | Runtime inference via Vultr `deepseek-v4.1-flash-1017`, identity-verified | VERIFIED | `packages/ai/src/vultr.ts` + `ai-provider.test.ts`; committed eval reports (4 runs) |
| 13 | Eval corpus 53 (30 live / 23 offline); 117/120 across 4 runs, latest 30/30, citation precision 1.000 | VERIFIED | `docs/evals/report-*.json`, `METRICS_SUMMARY.md`, `FAILURE_ANALYSIS.md` |
| 14 | Citation recall | NOT MEASURED | explicitly unclaimed (precision ≠ recall) |
| 15 | AI 59/60 vs heuristic 12/15 (shared 15 intents, heuristic scored as shipped) | VERIFIED with caveat | `BASELINE_COMPARISON.md` (asymmetric: 4 AI runs vs 1 heuristic run — caveat kept; TITAN VI fixed a baseline harness bug that had hardcoded ambiguities `[]` and understated the heuristic at 9/15) |
| 16 | Gallery shows RECORDED runs, never fake-live | VERIFIED | `apps/web/public/gallery/ai-gallery.json` + `ai.gallery.test.ts` + `gallery.e2e.ts` |
| 17 | AI proposes only; policy + human dispose; over-refunds refused never clamped | VERIFIED | `aiTasks.ts` gates + `ai.tasks/ai-tasks.test.ts` + policy engine tests |

## Product claims (Judge Mode / Twin / Recorder)

| # | Claim | State | Artifact |
|---|---|---|---|
| 18 | Recover (flagship 9 acts) completes with verified refund | VERIFIED | `runFlagship` + `apps.api/judge.e2e` + CI smoke |
| 19 | Hold: unapproved promise → policy Hold, order refused, no order record | VERIFIED | `runHold` + `demo.hold.test.ts` + `judge.e2e.ts` (act text + API re-read) |
| 20 | Refuse: merchant-swap + amount-increase both blocked with reason codes | VERIFIED | `runInjection` + `demo.sessions` + `judge.e2e.ts` |
| 21 | Outcome Twin shows promised/observed/recovered + divergence | VERIFIED | `renderTwin` + `twin.e2e.ts` |
| 22 | Flight Recorder hash chain validates; redacted export | VERIFIED | `verifyChain` + recorder tests + `twin.e2e.ts` CHAIN VALID |
| 23 | 25 concurrent flagships: 25/25 unique, chain valid | VERIFIED | `tests/integration/demo.concurrency.test.ts` (CI, in-memory) |
| 24 | Per-session / tenant isolation | NOT DONE | honest fallback documented (`SESSION_ISOLATION_REPORT.md` §6); drift-banned wording |

## AG Grid claims

| # | Claim | State | Artifact |
|---|---|---|---|
| 25 | Community 36.3.0 tables over live data (cross-filter, NL box, theme) | VERIFIED | vendored bundle + `sponsors.studio.timeline.test.ts` |
| 26 | Studio 3.1.0 canvas + Agent Framework over live data | VERIFIED | CDN-first SRI mount + `studio.e2e.ts` + `studio-agent-trace.png` (base loop) |
| 27 | Custom Outcome Risk Analyst agent + 3 read-only tools | VERIFIED | `ag-studio-risk-tools.js` + `studio-risk-tools.test.ts` (7) + `data-harness-kind` e2e assertion |
| 28 | No commercial bytes committed; EULA filed; CDN-first | VERIFIED | `git ls-files vendor/` empty of bundle + `vendor/*.LICENSE/NOTICE` + manifest `bundleTrackedInGit=false` |
| 29 | Trial key installed / consent received / judging window covered | OWNER ACTION REQUIRED | key none; consent drafted-not-sent; coverage UNKNOWN; fallback tested |
| 30 | Live keyed trace of the new custom tools | NOT DONE | needs inference key (owner); base-harness trace only |

## Impact & commercial claims

| # | Claim | State | Artifact |
|---|---|---|---|
| 31 | Machine timings (flagship ms-scale; 25-burst wall) | VERIFIED | eval/bench reports; labeled machine time, never user time |
| 32 | ~28 min manual workflow | ESTIMATE | `IMPACT_BENCHMARK.md`; labeled estimate, NOT measured |
| 33 | Independent usability sessions | NOT DONE | protocol ready (`USABILITY_STUDY.md`); zero sessions run |
| 34 | ROI figures / pilot / revenue | ESTIMATE / NOT DONE | assumptions-labeled docs only; no customers claimed |
| 35 | 637 ms figure | VERIFIED as machine time | must never be cited as human time saved |

## Presentation & submission claims

| # | Claim | State | Artifact |
|---|---|---|---|
| 36 | Final film 165.1 s 1080p30 EN + subs, QA-passed | VERIFIED | `brag-output/paypal-ai-2026/AFTERPACT_PAYPAL_AI_FINAL.mp4` + `.srt` + `VIDEO_QA_REPORT.md` |
| 37 | Public YouTube URL | OWNER ACTION REQUIRED | upload pending; no URL invented |
| 38 | Devpost submitted | OWNER ACTION REQUIRED | draft current (`DEVPOST_DRAFT.md`); submit pending |
| 39 | Demo free through judging (Dec 15) | PARTIAL | live today; upkeep is owner action |
| 40 | Single sponsor prize pursued (AG Grid); others filed non-claims | VERIFIED | `AG_GRID_STATUS.md`, `PRIZE_STRATEGY.md`, per-sponsor non-claim docs |
