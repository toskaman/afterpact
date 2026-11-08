# TITAN III FINAL REPORT — AFTERPACT Final Jury Dominance (2026-11-08)

## A. Verified repository status

- Repo: `https://github.com/toskaman/afterpact` (public, MIT), branch `main`.
- Verified configuration (point-in-time; docs-only commits after the
  freeze do not change it): runtime code frozen at `ba9edc8`, deployed
  as `d1e79f2` and verified live post-deploy (chain valid, flagship
  `completed`, anon reset 401, `keyed:false`).
- CI green on the frozen code and every follow-up (`verify`+`e2e`+`drift`
  SUCCESS, incl. runs `42479179914`, `42479676785`, `42479939443`).
- Suite: **288 passed / 33 skipped / 0 failed** (vitest) + **7/7 Playwright** +
  Newman 37/37 reqs, 18/18 assertions + `tsc` clean (6 projects) + drift-ok.
- Public demo: `https://199.247.9.188.nip.io` — health ok, audit chain
  valid (13 entries), flagship `completed`, anon reset 401, `keyed:false`.

T3 commit chain (this mission): `67773d6` AI failure analysis →
`965c06c` manifest → `2c6e157` chaos → `0a2a096` isolation →
`b8b4a32` persistence+baseline → `9b2d52b` UX → `0e6d45d` impact →
`120f4f5` sponsors → `ecbd28d` video → `a3e705a` attribution fix →
`ba9edc8` manifest. Intermediate drift failures on four commits
(statics went stale as designed) were fixed by the manifest regen;
no code failure occurred.

## B. Work completed

| Prior issue | Fix | Files | Tests |
|---|---|---|---|
| 3/90 live-eval failures unexplained | Failure analysis + `looseStringArray` coercion + `outputHead` diagnostics; 4th run 30/30 | `aiTasks.ts`, `vultr.ts`, `FAILURE_ANALYSIS.md` | 117/120 total |
| No chaos/concurrency campaign | 9 fault-injection tests + report (fail-closed only, no crash claim) | `paypal.chaos.test.ts`, `CHAOS_CAMPAIGN.md` | 9/9 |
| Demo continue ungated | Per-run token gate on continue+reset, frontend sends token | `routes.ts`, `app.js`, `demo.sessions.test.ts` | 9/9 |
| Single-node JSON, no recovery story | Option B: atomic tmp+rename kept, .bak rotation + shape check + backup-load | `store.ts`, `store.test.ts` | 4/4 |
| AI contribution unquantified | Shared-set baseline vs AI, same scorer, zero new spend | `BASELINE_COMPARISON.md`, `baseline.compare.test.ts` | 1/1 (drift-pinned) |
| Landing has no value prop / AI-off dead-ends | Hero CTA, gallery pointers in fallbacks+503s, copy-truth, footer, AG pagination | `app.js`, `index.html`, `twin.e2e.ts` | 7/7 e2e |
| Impact = machine timings only | Timed internal UI walkthrough (labeled NOT users) + buyer-case refresh | `WALKTHROUGH_INTERNAL.md` | 6/6 tasks |
| Prize-name conflict (Studio vs Grid) | Official "Best Use of AG Grid" verified at source, docs fixed | `OFFICIAL_RULES_AUDIT.md`, `AG_GRID_STATUS.md` | — |
| Channel3 prize ambiguity | Gap assessed, no-claim decision recorded (AG Grid stays single target) | `CHANNEL3_INTEGRATION.md` | — |
| Consent fallback = code change | `AG_STUDIO_DISABLED=1` kill-switch + Nov 11 EOD cutoff | `ops.ts`, `app.js`, `ag-studio-trial.md` | 2/2 |
| No video footage | 5 raw 1080p rushes (~53 s) for the owner's edit | `video-rushes/` (binaries gitignored) | ffmpeg-probed |

## C. Updated audit (142 questions)

PASS 114 · PARTIAL 21 · FAIL 5 (Q6/Q84/Q126/Q127/Q134: video file +
independent users) · UNKNOWN 2 (Q112/Q117: trial-window coverage).
Delta: Q113 PARTIAL→PASS (keyless-by-design decided + e2e-pinned);
Q140–Q142 added (all PASS). Every remaining non-PASS item needs the
owner (humans, video edit, AG Grid reply). Full table:
`docs/audit/100_QUESTIONS.md`.

## D. Jury scorecard (internal, NOT official)

| Criterion | Score | +/- | Key evidence → deduction |
|---|---:|---|---|
| Technological Implementation | 9/10 | = | Chaos 9/9, 117/120 AI, 59/60-vs-9/15 baseline, 288+7 green, box @ HEAD → −1 single-node (deliberate) + shared lists |
| Design | 9/10 | = | Hero CTA, AI-off pointers, keyboard verified, console-clean → −1 no outside usability session |
| Potential Impact | 8/10 | = | 637 ms walkthrough (machine, n=1) + labeled buyer case → −2 no human timings/users |
| Innovation | 9/10 | = | 120-scenario corpus, quantified AI lift, owned payment tail → −1 moat unproven |
| Presentation | 7/10 | = | Live @ HEAD, current Devpost, raw rushes → −3 no edited video file |

Total **42/50**, unchanged: T3 closed every engineer-actionable gap; the
8 missing points are all owner-side. Details: `SELF_SCORE.md`.

## E. Sponsor eligibility

- Selected: **AG Grid — "Best Use of AG Grid"** (official Devpost name;
  "Best Use of AG Studio" is the AG blog variant). Real Studio 3.1.0
  canvas + Agent Framework over live rows, Community tables beneath,
  trial watermark disclosed, attribution test-pinned.
- Residual: no trial key, consent drafted-not-sent, judging coverage
  UNKNOWN, historic UMD bytes in git history. Mitigations committed:
  kill-switch tested, fallback documented, cutoff Nov 11 EOD (else
  Community-only).
- Channel3: real integration, explicit no-claim (single-sponsor rule).
- Bryntum/APIMatic/Render/others: explicit non-claims intact.

## F. Financial safety

Executed: full PayPal lifecycle (mock 16-flow + live full-loop with
real IDs), idempotency/replay-before-gate, same-key serialization,
webhook HMAC+dedupe, currency/mismatch/over-refund/expired negatives,
kill-switch, chaos 9/9 (concurrent capture/refund, retry storms,
429/5xx, replay, corrupt snapshot, boundary amounts).
Known limits: no crash-recovery proof, single-node, no live-money mode
(never enabled). Recovery behavior: fail-closed everywhere; money moves
only via deterministic gate + human approval + provider verification.

## G. AI evaluation

Model: `deepseek-v4.1-flash-1017` via Vultr Serverless Inference,
identity verified per call. Dataset: 120 committed live scenarios
(4 runs: 87/90 + 30/30 = 117/120, $0.048225 total). Failure analysis:
3 root-caused (shape strictness × 2, citation gating × 1), fixed with
regression tests; run 4 clean. Grounding: citations verified against
citable IDs, ungrounded refs dropped + counted. Contribution: shared
15-scenario intent set, identical scorer — AI 59/60 vs heuristic 9/15
($0.014696 slice, 2199 ms mean; heuristic $0/sub-ms). Honest nuance:
the one AI miss is a case the heuristic passes.

## H. Product and impact

UX: expert 3-persona review → 8 bounded fixes, all screenshot-verified;
keyboard path proven; 0 console errors/warnings. Accessibility:
skip-link, focus-visible, reduced-motion, semantic markup (no full
WCAG claim). Measured: 637 ms machine time across 6 UI operator tasks
(localhost, internal n=1). Independent users: NONE — explicitly
NOT VERIFIED. Commercial: one-page buyer case with MEASURED/ASSUMED/
UNVALIDATED labels; pilot-shaped build; no traction claims.

## I. Presentation

- Video file: NOT rendered (owner edit). Delivered: 5 raw 1080p VP9
  rushes, ~53 s total, ffmpeg-probed + frame-checked, in `video-rushes/`
  with a shot-map README. Missing: hook, sandbox-proof assembly,
  recorder close-up, refusal demo, closing card, narration, captions.
- YouTube URL: none (`TBD:youtube-url` in draft).
- Devpost: draft current (problem→proof→value, honest per-sponsor
  statuses, testing instructions, no fictitious links).
- Owner-only left: edit + publish video, submit Devpost, trial form +
  consent mail, usability participant, keep Vultr to Dec 15.

## J. Final competitive assessment

1. Innovative? Post-payment outcome assurance (promise→payment→
   verification→authorized recovery→provider proof) — the tail
   pre-purchase guards ignore.
2. Why PayPal cares? Real Orders v2 full-loop + reconciliation +
   evidence exports that make PayPal the trust anchor for agent spend.
3. Why AG Grid cares? Genuine Studio canvas + agent over live
   financial rows, plus honest Community foundation.
4. Why a merchant pays? 8 touchpoints → 3 decisions, bounded agents,
   dispute-ready exports; pilot-measurable.
5. Hard to replicate? The 120-scenario eval corpus + policy packs +
   provenance discipline, not the mechanics (MIT).
6. Technical depth? Integer money, hash chains, idempotency proofs,
   chaos campaign, verified model identity, drift-governed docs.
7. What could prevent a prize? Missing video (mandatory), no outside
   users, unresolved Studio consent at cutoff.
8. Strongest differentiator? Verified recovery: AI proposes,
   determinism gates, human approves, provider confirms — all
   inspectable in the Flight Recorder.
9. Least supported claim? Any human-time saving (explicitly
   unmeasured, never claimed as fact).
10. Skeptic's first challenge? "Show me the video and one stranger
    using it." — both are owner actions, both prepared.

## K. Final verdict

**READY WITH EXTERNAL OWNER ACTIONS.**

Engineering is submission-complete: green CI, live box at HEAD,
evidence-backed docs, zero engineer-actionable audit gaps. The
submission cannot ship without the owner: <3-min video edit +
YouTube publish, Devpost submit, trial form + consent mail (cutoff
Nov 11 EOD), one usability session, Vultr kept to Dec 15.
