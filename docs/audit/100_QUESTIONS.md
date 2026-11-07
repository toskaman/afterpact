# AFTERPACT — 100-Question Self-Audit

Date: 2026-11-07. Baseline: commit `2a26d05`, 155 passed + 1 skipped,
`tsc` clean (5 projects). Status: **PASS** (evidence in repo),
**PARTIAL** (works with a noted gap), **FAIL** (missing/red),
**UNKNOWN** (could not verify here). Severity: **H**igh/**M**edium/**L**ow.
Nothing is PASS on confidence alone — every PASS names its artifact.

## 1. Rules, eligibility, prize strategy

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 1 | Does the build integrate PayPal meaningfully (not a button)? | Mock full-loop green; live: OAuth + create + get verified (`paypal.live`), live flagship order 4FH32915JA251353Y created; capture/refund await personal buyer | `paypal.live.test.ts`, `RELEASE_GATE.md` gate 15 | H | PARTIAL |
| 2 | Is AI essential, not decorative? | AI surfaces are deterministic (heuristic parse, rule matching, strict NL) and gate real flows; no LLM runs | README "AI scope", `ai.ts`, `nlparse.ts`, `studio.ts` | H | PARTIAL |
| 3 | Is the repo public with an OSI license? | MIT LICENSE in repo; repo is local-only, not yet public | `LICENSE`, `git log` | H | PARTIAL |
| 4 | Are install/test instructions reproducible? | Yes: README quickstart + `.env.example`; clean-install verified on isolated copy | README, `docs/RELEASE_GATE.md` gate 5 | H | PASS |
| 5 | Is a judge-accessible demo available? | Local only (`npm start` → :3001); no hosted URL, no video yet | `render.yaml` (unapplied), `DEMO_SCRIPT.md` (shot list) | H | FAIL |
| 6 | Is the demo video <3 min on public YouTube? | Not recorded; narration + shot list ready | `docs/demo/DEMO_SCRIPT.md` | H | FAIL |
| 7 | Will the project stay free through Dec 15, 2026? | Code is MIT and local-runnable; hosted availability depends on the Render step | `render.yaml`, `RENDER_DEPLOYMENT.md` | M | PARTIAL |
| 8 | Are submission materials in English? | Yes: README, docs, Devpost draft all English | `docs/demo/DEVPOST_DRAFT.md` | M | PASS |
| 9 | Is the 1-grand + 1-sponsor limit respected in strategy? | Yes: Grand-1st primary, AG Grid 1st primary sponsor, rest secondary/fallback | `docs/hackathon/PRIZE_STRATEGY.md` | M | PASS |
| 10 | Any IP/license redistribution risk? | No: MIT + zod MIT + AG Grid Community MIT vendored w/ license; no proprietary binaries | `LICENSE`, vendor LICENSE.txt, gate 14 | H | PASS |

## 2. Judges and professional evaluation

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 11 | Can a Dev Advocate install and run it in minutes? | Yes locally; hosted one-click pending Render | README Install, gate 5 | H | PARTIAL |
| 12 | Are PayPal operations real enough for an engineer judge? | Mock-verified end to end; live IDs pending creds | `paypal.flows/safety/live.test.ts` | H | PARTIAL |
| 13 | Is the audit trail convincing to a fintech reviewer? | Append-only hash chain + replay + redacted export, restart-persistence tested | `audit.ts`, `apps.api.test.ts` | M | PASS |
| 14 | Does the policy engine read as deterministic? | Pure functions → Cleared/Hold/Refused + refund gate, 22 unit tests | `packages/policy/`, `policy.test.ts` | M | PASS |
| 15 | Is refusal behavior demonstrable on demand? | Yes: `{"scenario":"injection"}` → both attacks blocked w/ reasons | `demo.ts`, `apps.api.test.ts` | M | PASS |
| 16 | Is the customer segment crisp for a PM judge? | Merchant ops teams/marketplaces, single persona | README, `COMMERCIAL_STRATEGY.md` | M | PASS |
| 17 | Is differentiation provable vs named competitors? | 10-entry landscape + 6-point checklist; Acts 5–8 have no pre-auth equivalent | `COMPETITIVE_LANDSCAPE.md` | M | PASS |
| 18 | Is AG Grid usage real for the sponsor judge? | Community tables on live data + NL; Studio honestly not claimed | `studio.ts`, `AG_GRID_STATUS.md` | H | PARTIAL |
| 19 | Is Channel3 usage real for its judge? | Keyed live search green (`channel3.live.test.ts`) + live search inside flagship Act 2; normalization/attribution asserted on real payloads | `channel3.ts`, `channel3.live.test.ts` | H | PASS |
| 20 | Can Postman/Render judges verify their slice? | Postman: 38-req collection validated; Render: config only, no URL | `postman/`, `render.yaml` | M | PARTIAL |

## 3. User problem and measurable impact

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 21 | Is the problem stated in one sentence? | "Payment succeeded but the commercial outcome failed, with no verifiable record or bounded recovery" | README problem | M | PASS |
| 22 | Who exactly feels it? | Merchant ops teams owning exception/refund queues | `COMMERCIAL_STRATEGY.md` | M | PASS |
| 23 | Is severity quantified? | Only as labeled hypotheses (2–8% exceptions, 15–45 min/case); no interviews | `COMMERCIAL_STRATEGY.md` P1–P4 | M | PARTIAL |
| 24 | Is there a controlled impact comparison? | Machine benchmark row only (flagship 6.2 ms etc.); no human baseline | `IMPACT_BENCHMARK.md` | M | PARTIAL |
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
| 36 | Does recovery touch real money paths? | Mock-verified refund+verify; live refund unexecuted | `paypal.flows.test.ts`, gate 15 | H | PARTIAL |
| 37 | Is there an end-to-end repro in one command? | `POST /api/demo/run flagship` → 9 acts completed; also `#/demo` | `demo.ts`, README flagship | M | PASS |
| 38 | Could a competitor demo the same in a weekend? | Mechanics yes (MIT); the eval corpus + policy packs are the compounding part | `tests/`, `COMPETITIVE_MOAT.md` | L | PASS |
| 39 | Are originality claims evidenced? | Each competitor entry states what AFTERPACT does differently | `COMPETITIVE_LANDSCAPE.md` | M | PASS |
| 40 | Any fabricated differentiation? | No: non-claims filed for Studio/Bryntum/APIMatic/Workflows | `docs/sponsors/*STATUS*.md` | H | PASS |

## 5. PayPal integration and financial correctness

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 41 | OAuth implemented + tested? | Cached OAuth via stubbed-fetch transport tests | `transport.ts`, `paypal.safety.test.ts` | H | PASS |
| 42 | Create→approve→capture→refund flow green? | 16 flow tests on mock; live: create verified (order 4FH32915JA251353Y), approve blocked by buyer account, capture/refund pending | `paypal.flows.test.ts`, gate 15 | H | PARTIAL |
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
| 57 | Cross-tenant access tested? | Single-tenant build; no tenant isolation claims made | — | M | UNKNOWN |
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
| 69 | Is Render deploy reproducible? | Blueprint + CI + health endpoint in repo; apply is a human step | `render.yaml`, `ci.yml` | H | PARTIAL |
| 70 | Was the Postman collection executed in Postman? | No: schema-validated + paths vitest-covered; Newman run pending | `postman/`, gate 11 | L | PARTIAL |

## 8. Architecture, performance, testing, operations

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 71 | Are module boundaries clean? | domain/policy/payments/api/web packages; demo uses same Ops methods as routes | repo layout, gate deliberates | M | PASS |
| 72 | Zero `tsc` errors on strict settings? | Exit 0 on 5 projects (strict + noUncheckedIndexedAccess) | orchestrator run 2026-11-07 | H | PASS |
| 73 | Full suite green? | 155 passed + 1 skipped (live probe, no creds) | orchestrator run 2026-11-07 | H | PASS |
| 74 | Concurrency suite exists? | Same-key serialization + duplicate capture/refund + webhook dedupe | safety + flows tests | M | PASS |
| 75 | Adversarial suite exists? | Injection double-block, replay/tamper/mismatch/over-refund/expired negatives | `apps.api`, safety tests | M | PASS |
| 76 | E2E beyond unit/integration? | API-driven flagship E2E + compiled-server smoke; no Playwright | `apps.api.test.ts`, gate 4 | M | PARTIAL |
| 77 | Performance measured? | Bench script + machine benchmark row; no load test | `bench.mjs`, `IMPACT_BENCHMARK.md` | L | PARTIAL |
| 78 | Outage behavior specified? | Fail-closed discovery, kill switch, webhook redelivery; no chaos suite | `channel3.ts`, `config.ts` | M | PARTIAL |
| 79 | Secrets handling verified? | No `.env`, placeholders only, redaction tests, presence-boolean status | gate 13, `redact.ts` | H | PASS |
| 80 | Clean shutdown / no runaway jobs? | Single-process server, no background loops; jobs in-process | `apps/api/src/index.ts` | L | PASS |

## 9. UX, accessibility, demo, presentation

| # | Question | Answer | Evidence | Sev | Status |
|---|---|---|---|---|---|
| 81 | Does the UI feel like a product, not an admin panel? | 9 views (Command, Copilot, Tx, Recovery, Recorder, Studio, Timeline, Developer, Demo) with dark/light + responsive | `apps/web/public/*` | M | PASS |
| 82 | Empty/loading/error states present? | Yes per-view states; monetary status never color-only | `app.js`, demo guide | M | PASS |
| 83 | Keyboard + screen-reader support? | Semantic HTML, labels, focus states, contrast, reduced-motion | `FRONTEND_DEMO_GUIDE.md` | M | PASS |
| 84 | Third-party usability test done? | No (single-session build); disclosed | demo guide limitations | L | FAIL |
| 85 | Flagship demo reproducible by a judge? | One API call or `#/demo` → Flagship; reset included | README flagship, `demo.ts` | H | PASS |
| 86 | Real-vs-simulated markers everywhere? | Origin badges on all surfaces; legend in guide | README policy, demo guide | H | PASS |
| 87 | Negative scenario demoable? | `injection` scenario: both attacks blocked w/ exact reasons | `demo.ts` | M | PASS |
| 88 | Screenshots / architecture diagram ready? | 9 headless-Edge captures of seeded flagship + Mermaid diagram; 0 console errors | `docs/demo/screenshots/`, `docs/architecture/ARCHITECTURE.md` | M | PASS |
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
| 100 | What is the single highest-value next step? | Live-sandbox flagship + hosted URL + video (gates 15–16) | `RELEASE_GATE.md` | H | PASS |

## Tally (2026-11-07)

PASS 77 · PARTIAL 19 · FAIL 3 (Q5 hosted demo, Q6 video, Q84 usability
test) · UNKNOWN 1 (Q57 multi-tenancy, out of scope for this
single-tenant build). All FAILs are human/external steps the owner can
clear before submission: Render deploy, <3-min video, one usability
session. (Q88 cleared 2026-11-07: screenshots + diagram committed. Q19
cleared same day: live Channel3 search verified.)

