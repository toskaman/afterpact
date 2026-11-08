# AFTERPACT — 100-Question Self-Audit

Date: 2026-11-07, re-verified 2026-11-08. Baseline: 255 passed +
33 skipped, `tsc` clean (6 projects), CI green at HEAD (the 2026-11-07
run recorded 155+1 at `2a26d05`). Status: **PASS** (evidence in repo),
**PARTIAL** (works with a noted gap), **FAIL** (missing/red),
**UNKNOWN** (could not verify here). Severity: **H**igh/**M**edium/**L**ow.
Nothing is PASS on confidence alone — every PASS names its artifact.

## 1. Rules, eligibility, prize strategy

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 1 | Does the build integrate PayPal meaningfully (not a button)? | Mock full-loop green + live full-loop completed: order→approval→capture→refund→verified (IDs in gate 15) | `paypal.live.test.ts`, `RELEASE_GATE.md` gate 15 | H | PASS |
| 2 | Is AI essential, not decorative? | Real Vultr inference (identity-verified) drives intent/incident/recovery/Studio-agent flows through gates; 53-scenario eval, strict fallbacks | `aiTasks.ts`, `studioAgent.ts`, `docs/evals/README.md` | H | PASS |
| 3 | Is the repo public with an OSI license? | Yes: github.com/toskaman/afterpact is PUBLIC, MIT LICENSE | `gh repo view`, `LICENSE` | H | PASS |
| 4 | Are install/test instructions reproducible? | Yes: README quickstart + `.env.example`; clean-install verified on isolated copy | README, `docs/RELEASE_GATE.md` gate 5 | H | PASS |
| 5 | Is a judge-accessible demo available? | Yes: `https://199.247.9.188.nip.io` (Vultr, valid TLS, mock one-click demo); health ok + flagship `completed` verified | `docs/demo/VULTR_HOSTING.md` | H | PASS |
| 6 | Is the demo video <3 min on public YouTube? | Not recorded; narration + shot list ready | `docs/demo/DEMO_SCRIPT.md` | H | FAIL |
| 7 | Will the project stay free through Dec 15, 2026? | Code is MIT and local-runnable; hosted demo is the owner's Vultr box (kept until Dec 15, then destroyed); no judge-facing fees | `VULTR_HOSTING.md`, `LICENSE` | M | PARTIAL |
| 8 | Are submission materials in English? | Yes: README, docs, Devpost draft all English | `docs/demo/DEVPOST_DRAFT.md` | M | PASS |
| 9 | Is the 1-grand + 1-sponsor limit respected in strategy? | Yes: Grand-1st primary, AG Grid 1st primary sponsor, rest secondary/fallback | `docs/hackathon/PRIZE_STRATEGY.md` | M | PASS |
| 10 | Any IP/license redistribution risk? | AG Studio commercial bytes NOT committed (official-CDN-first + build-time fallback); EULA + notice filed for attribution; LICENSE carve-out; consent request drafted (owner sends); rest MIT | `ag-studio.NOTICE.txt`, `ag-studio-trial.md`, `LICENSE` | H | PARTIAL |

## 2. Judges and professional evaluation

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 11 | Can a Dev Advocate install and run it in minutes? | Yes locally AND hosted one-click live (Vultr, mock, `#/demo` flagship) | README Install, `VULTR_HOSTING.md` | H | PASS |
| 12 | Are PayPal operations real enough for an engineer judge? | Mock-verified + live full-loop with real IDs (order/capture/refund) and provider reconciliation | `paypal.flows/safety/live.test.ts`, gate 15 | H | PASS |
| 13 | Is the audit trail convincing to a fintech reviewer? | Append-only hash chain + replay + redacted export, restart-persistence tested | `audit.ts`, `apps.api.test.ts` | M | PASS |
| 14 | Does the policy engine read as deterministic? | Pure functions → Cleared/Hold/Refused + refund gate, 22 unit tests | `packages/policy/`, `policy.test.ts` | M | PASS |
| 15 | Is refusal behavior demonstrable on demand? | Yes: `{"scenario":"injection"}` → both attacks blocked w/ reasons | `demo.ts`, `apps.api.test.ts` | M | PASS |
| 16 | Is the customer segment crisp for a PM judge? | Merchant ops teams/marketplaces, single persona | README, `COMMERCIAL_STRATEGY.md` | M | PASS |
| 17 | Is differentiation provable vs named competitors? | 10-entry landscape + 6-point checklist; Acts 5–8 have no pre-auth equivalent | `COMPETITIVE_LANDSCAPE.md` | M | PASS |
| 18 | Is AG Grid usage real for the sponsor judge? | Real Studio canvas + Agent Framework (own LLM adapter) over live rows; Community tables kept; NL prompt → widget verified | `ag-studio-adapter.js`, `studio-agent-trace.png` | H | PASS |
| 19 | Is Channel3 usage real for its judge? | Keyed live `POST /v1/search` 2026-11-08 ("mechanical keyboard", 3 candidates, 1187 ms, origin `channel3-live`); redacted report committed + test-pinned; client + fail-closed + normalization asserted | `channel3-live-report.json`, `channel3.report.test.ts`, manifest `channel3Live` | H | PASS |
| 20 | Can Postman/Render judges verify their slice? | Postman: Newman 37/37 reqs, 18/18 assertions, report committed; Render: config only (Vultr hosts instead) | `newman-report.json`, `render.yaml` | M | PARTIAL |

## 3. User problem and measurable impact

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 21 | Is the problem stated in one sentence? | "Payment succeeded but the commercial outcome failed, with no verifiable record or bounded recovery" | README problem | M | PASS |
| 22 | Who exactly feels it? | Merchant ops teams owning exception/refund queues | `COMMERCIAL_STRATEGY.md` | M | PASS |
| 23 | Is severity quantified? | Only as labeled hypotheses (2–8% exceptions, 15–45 min/case); no interviews | `COMMERCIAL_STRATEGY.md` P1–P4 | M | PARTIAL |
| 24 | Is there a controlled impact comparison? | Controlled self-test: 8-touch manual procedure vs measured 3-decision assisted run (20 ms fallback / ~4 s live); no human baseline | `OPERATOR_IMPACT.md`, `operator-benchmark.mjs` | M | PARTIAL |
| 25 | Are improvements computed from observations? | Yes where claimed (test timings, E2E assertions); no invented % savings | `scripts/bench.mjs`, gate 12 | M | PASS |
| 26 | Are synthetic data labels honest? | Yes: SIMULATED/HEURISTIC badges on all non-live surfaces | README labeling policy | H | PASS |
| 27 | Is evidence completeness measurable? | Provenance+confidence on every evidence item; Studio KPI surfaces gaps | `outcome.ts`, `studio.ts` | L | PASS |
| 28 | Are incorrect refund proposals counted? | Over-refund attempts are refused by two bounds (local + provider) with tests | `refund.ts`, `paypal.safety.test.ts` | M | PASS |
| 29 | Are prevented policy violations visible? | Yes: injection scenario preserves rejections in the Recorder | `apps.api.test.ts` | M | PASS |
| 30 | Any validated user benefit claim? | No — and none is made; impact section claims system metrics only | `IMPACT_BENCHMARK.md` | M | PASS |

## 4. Innovation and differentiation

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 31 | What is the one new capability? | Post-payment commercial-outcome assurance: promise tracking + authorized verifiable recovery | README, flagship Acts 5–8 | H | PASS |
| 32 | Is it more than budget enforcement? | Yes: budget tools stop at approval; AFTERPACT verifies outcomes and recovers funds | `COMPETITIVE_LANDSCAPE.md` | H | PASS |
| 33 | Is the promise object real? | Versioned, hash-chained, approval-bound, expiry-enforcing; 11 tests | `promise.ts`, `promise.test.ts` | H | PASS |
| 34 | Do material changes invalidate approval? | Yes: version/hash rebind required, tested | `approval.ts`, `approval.test.ts` | H | PASS |
| 35 | Is the Flight Recorder more than a log? | Hash-chained, append-only, replayable, exportable (redacted), restart-persistent | `audit.ts`, `#/recorder`, export test | M | PASS |
| 36 | Does recovery touch real money paths? | Live sandbox refund 8DJ895035B173303G executed for 12999 USD and verified `succeeded` at the provider | gate 15 | H | PASS |
| 37 | Is there an end-to-end repro in one command? | `POST /api/demo/run flagship` → 9 acts completed; also `#/demo` | `demo.ts`, README flagship | M | PASS |
| 38 | Could a competitor demo the same in a weekend? | Mechanics yes (MIT); the eval corpus + policy packs are the compounding part | `tests/`, `COMPETITIVE_MOAT.md` | L | PASS |
| 39 | Are originality claims evidenced? | Each competitor entry states what AFTERPACT does differently | `COMPETITIVE_LANDSCAPE.md` | M | PASS |
| 40 | Any fabricated differentiation? | No: Studio genuinely integrated (trial disclosed); non-claims stand for Bryntum/APIMatic/Workflows | `docs/sponsors/*STATUS*.md` | H | PASS |

## 5. PayPal integration and financial correctness

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 41 | OAuth implemented + tested? | Cached OAuth via stubbed-fetch transport tests | `transport.ts`, `paypal.safety.test.ts` | H | PASS |
| 42 | Create→approve→capture→refund flow green? | 16 flow tests on mock + live end-to-end completed (order 2ER387580K033722V, capture 7R158417X9367771B, refund 8DJ895035B173303G `succeeded`) | `paypal.flows.test.ts`, gate 15 | H | PASS |
| 43 | Is money exact (no floats)? | Integer minor units + currency-aware decimals + wire parse/format | `money.ts`, `money.test.ts` | H | PASS |
| 44 | `PayPal-Request-Id` on writes? | Yes, asserted in transport tests | `transport.ts` | H | PASS |
| 45 | Replay-before-gate idempotency? | Same-key retry after completion replays; different payload refused; 2 real bugs fixed here | `service.ts`, `store.ts`, safety tests | H | PASS |
| 46 | Concurrent same-key ops serialize? | 1 success + 1 duplicate, tested | `paypal.safety.test.ts` | H | PASS |
| 47 | Webhook verify + dedupe + replay refusal? | HMAC verify, duplicate apply-once, replay/tamper rejection tested | `webhooks.ts`, safety tests | H | PASS |
| 48 | Currency mismatch refused? | Capture + refund mismatch negatives pass | `paypal.safety.test.ts` | H | PASS |
| 49 | Over-refund doubly bounded? | Local capture bound + provider bound; both tested | `refund.ts`, `reconcile.ts` | H | PASS |
| 50 | Kill switch + live-mode guard? | Kill switch refuses new ops (reads open); live needs mode+opt-in | `config.ts`, safety tests | H | PASS |

## 6. AI reasoning, permissions, safety, adversarial resistance

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 51 | Can AI move money directly? | No: AI-shaped outputs are Zod-validated proposals; code + human decide | `ai.ts`, `scopedTools.ts` | H | PASS |
| 52 | Can AI change merchant or raise amounts? | No: merchant-unknown refusal + increase-since-approval refusal, tested | `engine.ts`, `policy.test.ts` | H | PASS |
| 53 | Price-inflation injection blocked? | Yes: injection scenario amount-increase attempt blocked w/ reason | `apps.api.test.ts` | H | PASS |
| 54 | Merchant-substitution blocked? | Yes: merchant-swap attempt blocked, evidence preserved | `apps.api.test.ts` | H | PASS |
| 55 | Fake preapproval rejected? | Approval must bind version+hash and be unexpired; fakes fail validation | `approval.ts`, `approval.test.ts` | H | PASS |
| 56 | Duplicate refund attempts refused? | Idempotency + bounds; same-key duplicate returns prior result | safety + flows tests | H | PASS |
| 57 | Cross-tenant access tested? | Single-tenant BY DESIGN (no isolation); public demo shares mock state; live runs local-only; rate limits + operator token bound abuse | `SECURITY.md`, `security.test.ts` | M | PARTIAL |
| 58 | Expired approval enforced? | Expiry negatives pass (unit + provider-level) | `approval.test.ts`, safety tests | H | PASS |
| 59 | Approval races handled? | Same-key serialization covers concurrent approvals; no distributed lock (single node) | safety tests | M | PARTIAL |
| 60 | Corrupted webhooks rejected? | Tampered-signature + malformed-payload negatives pass | `webhooks.ts`, safety tests | H | PASS |

## 7. Sponsor depth and prize eligibility

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 61 | Does Studio use real data (not a static mock)? | Datasets from live store state, asserted vs fixtures; Act 9 regenerates live | `studio.ts`, studio tests | H | PASS |
| 62 | Do NL commands change real dashboard state? | Strict NL filters query/mutate live view state; tokenizer fix tested | `studio.ts`, `nlparse.ts` | H | PASS |
| 63 | Is AG Grid vendoring reproducible? | Pinned 36.3.0 + SHA-256 verify script + MIT license filed | `vendor-ag-grid.mjs` | M | PASS |
| 64 | Does discovery normalize + attribute sources? | Minor-unit norm, unknowns-stay-unknown, per-offer attribution + disclaimer | `channel3.ts`, discovery tests | M | PASS |
| 65 | Does discovery fail closed without a key? | HTTP 503 + `unconfigured`, verified over HTTP; nothing fabricated | discovery tests, flagship Act 2 | H | PASS |
| 66 | Does an incident alter schedule dependencies? | Category-based rescheduling w/ `shiftedByIncident`, asserted | `timeline.ts`, timeline tests | M | PASS |
| 67 | Is APIMatic claimed without use? | No: affirmative non-claim filed, prize not pursued | `APIMATIC_EVIDENCE.md` | M | PASS |
| 68 | Is Bryntum claimed without use? | No: fallback honestly labeled, prize not pursued | `BRYNTUM_STATUS.md` | M | PASS |
| 69 | Is Render deploy reproducible? | Blueprint + CI in repo but Render NOT pursued (no card); Vultr script deploys instead | `render.yaml`, `afterpact_deploy.sh` | H | PARTIAL |
| 70 | Was the Postman collection executed in Postman? | Yes via Newman: 37/37 requests, 18/18 assertions, 0 failures; report committed (folder 09 sandbox-OAuth excluded, needs creds) | `postman/newman-report.json` | L | PASS |

## 8. Architecture, performance, testing, operations

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 71 | Are module boundaries clean? | domain/policy/payments/api/web packages; demo uses same Ops methods as routes | repo layout, gate deliberates | M | PASS |
| 72 | Zero `tsc` errors on strict settings? | Exit 0 on 6 projects (strict + noUncheckedIndexedAccess) | OMEGA run 2026-11-08 | H | PASS |
| 73 | Full suite green? | 255 passed + 33 skipped (30 live-eval + 3 probes, keys absent) + 6 Playwright E2E | OMEGA II run 2026-11-08 | H | PASS |
| 74 | Concurrency suite exists? | Same-key serialization + duplicate capture/refund + webhook dedupe | safety + flows tests | M | PASS |
| 75 | Adversarial suite exists? | Injection double-block, replay/tamper/mismatch/over-refund/expired negatives | `apps.api`, safety tests | M | PASS |
| 76 | E2E beyond unit/integration? | Playwright chromium in CI: dashboard, copilot, twin, recovery, studio mount, ai-gallery; 6 specs green, 0 page errors | `tests/e2e/`, `ci.yml` e2e job | M | PASS |
| 77 | Performance measured? | Machine bench + AI eval latencies (p50 3.1 s, p95 6.3 s) + operator benchmark; no load test | `IMPACT_BENCHMARK.md`, `docs/evals/` | L | PARTIAL |
| 78 | Outage behavior specified? | Fail-closed discovery/AI (evals cover timeout/outage/mismatch), kill switch, webhook redelivery; no chaos suite | `channel3.ts`, `config.ts`, `ai-eval` | M | PARTIAL |
| 79 | Secrets handling verified? | No `.env`, placeholders only, redaction tests, presence-boolean status | gate 13, `redact.ts` | H | PASS |
| 80 | Clean shutdown / no runaway jobs? | Single-process server, no background loops; jobs in-process | `apps/api/src/index.ts` | L | PASS |

## 9. UX, accessibility, demo, presentation

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 81 | Does the UI feel like a product, not an admin panel? | 10 views (+ Outcome Twin; Studio hosts the AG Studio canvas) with dark/light + responsive | `apps/web/public/*` | M | PASS |
| 82 | Empty/loading/error states present? | Yes per-view states; monetary status never color-only | `app.js`, demo guide | M | PASS |
| 83 | Keyboard + screen-reader support? | Semantic HTML, labels, focus states, contrast, reduced-motion | `FRONTEND_DEMO_GUIDE.md` | M | PASS |
| 84 | Third-party usability test done? | No (single-session build); disclosed | demo guide limitations | L | FAIL |
| 85 | Flagship demo reproducible by a judge? | One API call or `#/demo` → Flagship; reset included | README flagship, `demo.ts` | H | PASS |
| 86 | Real-vs-simulated markers everywhere? | Origin badges on all surfaces; legend in guide | README policy, demo guide | H | PASS |
| 87 | Negative scenario demoable? | `injection` scenario: both attacks blocked w/ exact reasons | `demo.ts` | M | PASS |
| 88 | Screenshots / architecture diagram ready? | 13 captures incl. Twin + Studio canvas + agent-built widget; Mermaid diagram; 0 page errors | `docs/demo/screenshots/`, `docs/architecture/ARCHITECTURE.md` | M | PASS |
| 89 | Video script + shot list ready? | Yes, <3-min structure with timestamps | `DEMO_SCRIPT.md` | H | PASS |
| 90 | Devpost draft complete? | All sections drafted; URLs/creds marked TBD | `DEVPOST_DRAFT.md` | H | PASS |

## 10. Commercialization, scalability, defensibility

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 91 | Initial customer + persona defined? | Merchant ops teams, one refund-queue persona | `COMMERCIAL_STRATEGY.md` | M | PASS |
| 92 | Pricing model hypothesized without fake validation? | SaaS + usage tiers; figures deliberately absent | `COMMERCIAL_STRATEGY.md` | M | PASS |
| 93 | Unit economics sketched honestly? | Cost drivers + H1–H3 + invalidation conditions | `UNIT_ECONOMICS.md` | L | PASS |
| 94 | Moat claims restrained? | No moat claimed today; 5 earnable sources listed | `COMPETITIVE_MOAT.md` | M | PASS |
| 95 | Partners vs competitors separated? | Yes; zero outreach claimed | `STRATEGIC_PARTNERS.md` | L | PASS |
| 96 | Acquisition speculation labeled? | Yes: scenario planning, no corporate interest implied | `STRATEGIC_PARTNERS.md` | L | PASS |
| 97 | Scaling path beyond single node? | Not designed: JSON store, in-process jobs, no distributed locks | README limitations | M | PARTIAL |
| 98 | Procurement objections anticipated? | Scope fears, autonomy fears, evidence questions + answers | `COMMERCIAL_STRATEGY.md` | L | PASS |
| 99 | Pilot success criteria defined? | Time-to-resolve, evidence completeness, leakage prevented | `COMMERCIAL_STRATEGY.md` | M | PASS |
| 100 | What is the single highest-value next step? | Trial key + redeploy + video (flagship/hosting done; gates 15–16) | `RELEASE_GATE.md` | H | PASS |

## 11. OMEGA round: runtime AI, Studio agent, public demo (2026-11-08)

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 101 | Is the served model identity verified on every call? | Yes: mismatch throws, never silently accepted; evals cover substitution | `vultr.ts`, `ai.live`, `ai-eval` | H | PASS |
| 102 | Is prompt injection contained at the AI layer? | Yes: scans flag, gates hold whatever the model says (eval: purchase/note/detail injections) | `aiTasks.ts` gates, `docs/evals/` | H | PASS |
| 103 | Are AI costs bounded and accounted? | Yes: per-call ledger, token caps, measured $0.0135/eval and $0.023/agent loop | `service.ts` ledger, eval reports | M | PASS |
| 104 | Is the Studio licence handled compliantly? | Commercial bundle + LICENSE.html vendored; trial = documented evaluation path; no key in git | `vendor/`, `AG_GRID_STATUS.md` | H | PASS |
| 105 | Is the trial watermark disclosed, not hidden? | Yes: LICENSED/TRIAL pill in UI + every doc that claims Studio | `app.js`, README, Devpost draft | M | PASS |
| 106 | Are operator routes protected on shared deploys? | Yes when OPERATOR_TOKEN set (constant-time compare); open-by-default local is documented | `routes.ts`, `security.test.ts` | H | PASS |
| 107 | Are rate limits real and proxy-aware? | 120/min/IP + Retry-After + loopback-only XFF; webhooks exempt; tested | `routes.ts`, `security.test.ts` | M | PASS |
| 108 | Is demo state isolated per visitor? | No: shared mock snapshot (single-tenant); reset is operator-gated but state is communal | `SECURITY.md` | M | PARTIAL |
| 109 | Are Studio agent failures safe? | Yes: strict proxy (503/502/422), failures surface in chat, never fabricated turns | `studioAgent.ts`, E2E + live trace | H | PASS |
| 110 | Can judges reproduce the AI eval? | Offline: yes, deterministic in CI. Live: yes with own key (~$0.015/run) | `tests/eval/`, `docs/evals/README.md` | M | PASS |
| 111 | Will the demo survive the Dec 1–15 judging window? | Box + code: yes if owner keeps the VPS. Trial key coverage: pending owner form | `VULTR_HOSTING.md`, Q112 | H | PARTIAL |
| 112 | Does the Studio trial cover the judging window? | UNKNOWN until the owner completes the trial form and confirms dates | `AG_STUDIO_UPGRADE_PATH.md` | H | UNKNOWN |
| 113 | Is live AI on or off on the public demo? | Undecided: key-on-box = spend risk under rate limits; fallback mode is the safe default | `SECURITY.md` | M | PARTIAL |
| 114 | Are unused sponsors still honestly non-claimed? | Yes: Bryntum/APIMatic/Render non-claims intact after the Studio flip | `docs/sponsors/*STATUS*.md` | M | PASS |

## Tally (2026-11-08 delta)

PASS 98 · PARTIAL 13 · FAIL 2 (Q6 video, Q84 usability test) ·
UNKNOWN 1 (Q112 trial-window coverage, owner action).

## Tally (2026-11-08 OMEGA II docs-truth pass)

PASS 96 · PARTIAL 15 · FAIL 2 (Q6 video, Q84 usability test) ·
UNKNOWN 1 (Q112). Changes: Q10 → PARTIAL (consent drafted, not sent),
Q19 → PARTIAL (Channel3 live retracted pending artifact). Both flip back
to PASS only with the filed reply / committed live evidence.

## Tally (2026-11-08 OMEGA II live-artifacts pass)

PASS 97 · PARTIAL 14 · FAIL 2 (Q6 video, Q84 usability test) ·
UNKNOWN 1 (Q112). Change: Q19 → PASS (keyed live Channel3 call with
committed redacted artifact + test pin, manifest `channel3Live.grade=artifact`).
PayPal loop re-verified same day (`paypal-live-receipts.json`,
manifest `paypalLiveLoop.grade=artifact`).

Delta since 2026-11-07: Q2, Q3, Q11, Q18, Q70, Q76 → PASS (runtime AI,
public repo, hosted one-click, real Studio, Newman evidence, Playwright
E2E); Q57 UNKNOWN → PARTIAL (single-tenant by design, documented);
Q10/Q20/Q24/Q40/Q69/Q72/Q73/Q77/Q78/Q81/Q88/Q100 answers refreshed with
OMEGA evidence; 14 OMEGA questions added (10 PASS, 3 PARTIAL, 1 UNKNOWN).
Both FAILs remain the owner's steps: <3-min video, one usability session.

