# AFTERPACT — Jury Evidence Matrix

Judge roster and prize/criteria facts verified on the Devpost page body +
rules §§6,8 (2026-11-07). Professional backgrounds from public bios as noted;
no personal preferences invented. Judges may change.

Status key: **PASS** (implemented + test-verified), **PARTIAL** (works with a
noted gap), **NOT VERIFIED** (real path, unexecuted — needs creds/humans),
**NOT PURSUED** (deliberately out of scope, with a filed non-claim),
**NOT DONE** (planned, not built).

Verification baseline (2026-11-08; supersedes the 2026-11-07 baseline at
`2a26d05`): `tsc --noEmit` exit 0 on all 6 projects; `vitest run` →
**245 passed, 33 skipped** (skips = keyless live probes + live evals);
`tsc -p apps/api` build exit 0; `node --check` on
`apps/web/public/app.js` exit 0; Newman executed (37/37 requests, 18/18
assertions); Playwright E2E 5/5 in CI; no secrets in repo (`.env` absent,
`.env.example` placeholders only). Machine source of truth:
`docs/hackathon/RELEASE_EVIDENCE_MANIFEST.json`.

## Judges

PayPal: Jo Franchetti, Eddie Jaoude, Marco Podien (Developer Advocates);
Karthik Ravi (Software Engineer, AI/ML — Cosmos.AI platform, ML infra);
Himraj Singh (Engineering Manager — title only, no public bio found);
Nathaniel Olson (Senior Technical Product Manager, PayPal API products;
co-originated API Context Plugins with APIMatic).
Sponsors: Sylwia Vargas (AG Grid, DevRel strategist, authored AG Grid
hackathon post); Ameer Hassan (APIMatic Co-founder/CCO Strategy &
Partnerships); Mats Bryntse (Bryntum founder/CEO); Ignacio Valdez Bicard
(Channel3 Founding Engineer — title only); Carly Richmond (Elastic, Principal
Dev Advocate & Manager, ex-investment-bank frontend/tech-lead); Pooja Mistry
(Postman, Sr Dev Advocate Enterprise Adoption, ex-IBM Cloud/Watson Health);
Shifra Williams (Render, Founding DevRel Engineer, data-science/educator
background).

## Matrix

### Developer advocacy (Franchetti, Jaoude, Podien, Vargas, Mistry, Williams)

| Requirement | Evidence | Status |
|---|---|---|
| Exceptional documentation | `README.md` (problem, differentiation, PayPal, AI, real-vs-simulated, install, test, flagship repro, proofs, sponsors, limitations), `SECURITY.md`, `CONTRIBUTING.md`, `docs/payments/PAYPAL_INTEGRATION.md`, `apps/api/README.md` | **PASS** |
| Simple installation | README quickstart + `.env.example` (placeholders only); clean-install verified on isolated copy per `docs/RELEASE_GATE.md` gate 5 | **PASS** |
| Clean SDK integrations | `packages/payments/*` PayPal client; `apps/api/src/channel3.ts` Channel3 client; AG Grid Community vendored via `scripts/vendor-ag-grid.mjs` (SHA-256 verified) | **PASS** |
| Intuitive onboarding | README + `docs/demo/DEMO_SCRIPT.md` + `docs/demo/FRONTEND_DEMO_GUIDE.md` (jury script, provenance legend) | **PASS** |
| Accessible design | Dark+light, responsive, keyboard/semantics/focus/contrast/reduced-motion in `apps/web/public/*`; screen-reader labels; no third-party usability test (disclosed in demo guide) | **PARTIAL** |
| Convincing DX | Typed errors (`packages/payments/src/errors.ts`), per-package READMEs, Postman collection (10 folders/38 requests, JSON-validated) | **PASS** |
| Clear error messages | `PayPalErrorCode` taxonomy + exact error codes asserted in `tests/integration/paypal.safety.test.ts` (17 tests) and Postman negatives | **PASS** |
| Reproducible examples | Postman collection + `POST /api/demo/run flagship` reproducible scenario + `POST /api/demo/reset`; no standalone seed script (reset via API instead) | **PASS** |

### Financial software engineering (Ravi, Singh, Richmond-background)

| Requirement | Evidence | Status |
|---|---|---|
| Real PayPal operations | Mock full-loop (16 tests) + live full-loop completed 2026-11-07: order 2ER387580K033722V → buyer approval → capture 7R158417X9367771B → partial refund 8DJ895035B173303G (12999 USD, `succeeded`) → Recorder chain-VALID | **PASS** |
| Idempotency | `PayPal-Request-Id` on writes, fingerprint-on-raw-request replays, duplicate-webhook dedupe; `tests/integration/paypal.safety.test.ts` + same-key concurrency test (1 success + 1 duplicate) | **PASS** (mock) |
| Permission boundaries | Scoped server tools (`packages/payments/src/scopedTools.ts`, incl. provider-import guard test); AI proposes via Zod-validated outputs, deterministic code decides, human approves | **PASS** |
| Transaction integrity | Integer minor units, currency-aware decimals, PayPal wire format/parse (`packages/domain/src/money.ts`); 17-state lifecycle with `InvalidTransitionError` (`lifecycle.ts`); totals footing (`offer.ts`) | **PASS** |
| Correct failure recovery | Webhook redelivery/dedupe/replay refusal, tampered-signature rejection, provider-state reconciliation (`reconcile.ts`), restart restores hash-chained audit log (verified in `apps.api.test.ts`) | **PASS** (mock) |
| Safe concurrency | Concurrent same-key capture+refund serialize to 1 success + 1 duplicate; kill switch refuses new ops while reads/webhooks stay open | **PASS** (mock) |
| Comprehensive logging | Append-only hash-chained `AuditEvent` log, no update/delete (`packages/domain/src/audit.ts`); Flight Recorder replay + redacted export (`apps/web` `#/recorder`, export test) | **PASS** |
| Automated tests | 245 passed + 33 skipped across 26 files; `tsc` clean on 6 projects; CI `verify`+`e2e` green at HEAD (`actions/runs/42437533785`) | **PASS** |

### AI platform reliability (Ravi / Cosmos.AI lens)

| Requirement | Evidence | Status |
|---|---|---|
| Prompt-injection resistance | Negative demo scenario: malicious description attempts merchant/amount change → deterministic policy engine blocks; injection double-block test in `tests/integration/apps.api.test.ts` with merchant-unknown evidence in Flight Recorder | **PASS** |
| Structured validated AI outputs | Zod schemas on all model outputs (`packages/domain/src/ai.ts`), 5 validation tests in `tests/unit/ai.test.ts` | **PASS** |
| Deterministic financial policies | Pure policy engine → Cleared/Hold/Refused + refund gate (`packages/policy/src/engine.ts`), 11 tests in `tests/unit/policy.test.ts`; the engine gates LLM outputs (model proposes, policy + human dispose) | **PASS** |
| Refusal behavior | Policy refusal path covered by tests; Flight Recorder preserves rejection evidence (injection test asserts the entry) | **PASS** |
| Controlled tool permissions | Tool manifest in `scopedTools.ts`; AI proposes, code validates, human approves; no direct provider access from AI outputs | **PASS** |
| Reproducible evaluations | Deterministic fixtures + scripted commands (`vitest run`, flagship demo run, `scripts/bench.mjs`) plus a 30-scenario live LLM eval, 30/30 with disclosed variance (`docs/evals/`, canonical report 2026-11-08T01-08-51Z) | **PASS** |
| Graceful degraded operation | Sponsor-failure isolation: Channel3 unconfigured → HTTP 503 fail-closed (tested); Studio native fallback without AG Grid; kill-switch degraded mode (tested) | **PASS** |

### Product management (Olson, Hassan, Bryntse)

| Requirement | Evidence | Status |
|---|---|---|
| Clear customer segment | Merchant ops teams / marketplaces as primary persona (README + `docs/competition/COMPETITIVE_LANDSCAPE.md`) | **PASS** |
| Validated pain points | Problem statement grounded in competitor gaps (`COMPETITIVE_LANDSCAPE.md`, 10 entries); no external user interviews — labeled as hypothesis | **PARTIAL** |
| Strong differentiation | Post-payment assurance vs pre-auth crowd; flagship Acts 5–8 (incident→resolution→verified refund) green in `apps.api.test.ts` | **PASS** |
| Quantifiable impact | `docs/benchmarks/IMPACT_BENCHMARK.md` (one machine-recorded row: flagship 6.2 ms etc.); Studio KPIs (amounts-at-risk → verified refunds) on live data; no live-user metrics | **PARTIAL** |
| Customer adoption pathway | Single ops-team persona onboarding path via Demo/Jury mode (`#/demo`, reset controls, real-vs-simulated markers) | **PASS** |
| Credible commercialization | `docs/business/COMMERCIAL_STRATEGY.md`, `UNIT_ECONOMICS.md`, `COMPETITIVE_MOAT.md`, `STRATEGIC_PARTNERS.md` — hypotheses explicitly labeled | **PASS** |

### AG Grid (Vargas)

| Requirement | Evidence | Status |
|---|---|---|
| Real AG Studio integration | `ag-studio@3.1.0` loaded SHA-pinned from the official AG Grid CDN (SRI-checked; commercial license filed; zero bytes committed) driving the `#/studio` canvas over live datasets; trial watermark until `AG_STUDIO_LICENSE_KEY` is set | **PASS** |
| AG Grid Community integration | AG Grid Community 36.3.0 vendored (SHA-256 `5fc8736c…`, MIT license filed, `scripts/vendor-ag-grid.mjs` verifies) driving `#/studio` grids on live data | **PASS** |
| Bespoke visualizations / custom widgets | Commerce Intelligence Studio: KPI widgets + incident/merchant views from live store state (`apps/api/src/studio.ts`) | **PASS** |
| Cross-filtering | Global filters wired across Studio widgets, asserted in `tests/integration/sponsors.studio.timeline.test.ts` | **PASS** |
| Interactive analytics | Drill-down on incidents/refunds/merchants over live datasets | **PASS** |
| Strict NL dashboard queries | `incidents unresolved refunds >$100` etc. with rejection+hints (tokenizer fix covered by tests); Act 9 regenerates Studio from live data (`passed/real-api`) | **PASS** |
| Studio Agent Framework | Real `directLlmRunner` loop with our own Vultr-backed `AgLlmAdapter` via `POST /api/ai/studio-turn`; verified live: NL prompt → Page+Widget delegation → configured bar chart from live rows (13 turns, $0.023, screenshot `studio-agent-trace.png`) | **PASS** |

### APIMatic (Hassan, Olson)

| Requirement | Evidence | Status |
|---|---|---|
| Context Plugin actually used | Plugin never installed/used | **NOT PURSUED** — affirmative non-claim in `docs/sponsors/APIMATIC_EVIDENCE.md`; prize not claimed |
| API contract correctness | PayPal wire format/parse + strict validation covered by mock-transport tests | n/a (no APIMatic claim) |
| Traceable integration decisions | `docs/payments/PAYPAL_INTEGRATION.md` | n/a (no APIMatic claim) |
| Robust API error handling | `PayPalErrorCode` taxonomy + 429/422/timeout mapping tests | n/a (no APIMatic claim) |

### Bryntum (Bryntse)

| Requirement | Evidence | Status |
|---|---|---|
| Real dependency-aware scheduling | **Not claimed.** Custom fallback timeline recomputed from live state (`apps/api/src/timeline.ts`), labeled `FALLBACK TIMELINE`; no Bryntum package/license in the build (`docs/sponsors/BRYNTUM_STATUS.md`) | **NOT PURSUED** (Bryntum proper) |
| Timeline reorganization | Incident shifts schedule dependencies, asserted in tests (`shiftedByIncident` stamps) | **PASS** (fallback) |
| Operational deadlines | Capture/delivery/evidence/merchant-window/notify/approval/settlement/escalation milestones on the timeline | **PASS** (fallback) |
| Task updates from commercial events | Incident → task mutation wiring + tests | **PASS** (fallback) |

### Channel3 (Bicard)

| Requirement | Evidence | Status |
|---|---|---|
| Real product search requests | Live execution claimed 2026-11-07 but WITHOUT a committed artifact — retracted to **NOT VERIFIED** pending a keyed re-run with committed evidence (see manifest `channel3Live`); client + fail-closed path test-verified | **NOT VERIFIED** |
| Normalization + comparison | Minor-unit normalization, unknowns-stay-unknown, per-currency comparison, ranking explanations (`channel3.ts` + 18 tests in `sponsors.discovery.test.ts`) | **PASS** (against stubs) |
| Source transparency | Merchant/source attribution per offer + checkout disclaimer (discovery ≠ chargeable merchant) | **PASS** |
| AI selection on real results | Routing to the authorized sandbox offer verified on stubbed discovery payloads; live-payload tracing NOT VERIFIED with the live call above; keyless fallback tested and labeled | **PARTIAL** |
| Failure isolation | Unconfigured → HTTP 503 fail-closed verified over HTTP; never fabricates availability | **PASS** |

### Elastic (Richmond)

| Requirement | Evidence | Status |
|---|---|---|
| Evidence search/retrieval | Not implemented (P2 — cut for scope; incident grounding done via structured evidence store instead) | **NOT PURSUED** |
| Grounded incident reasoning | Resolution rationale cites structured evidence with provenance+confidence (`outcome.ts`, `incident.ts`) | **PASS** (without Elastic) |
| Measured retrieval quality | n/a | **NOT PURSUED** |

### Postman (Mistry)

| Requirement | Evidence | Status |
|---|---|---|
| Reproducible API collections | `postman/AFTERPACT.postman_collection.json` — validated: 10 folders, 38 requests | **PASS** |
| Positive + negative scenarios | Auth helper, positive flows, exact-error-code negatives in collection | **PASS** (schema) |
| Idempotency + error tests | Idempotency replay + error-response cases in collection; same paths covered by vitest | **PASS** (schema) |
| Developer onboarding | Setup instructions in collection docs + README | **PASS** |
| Execution inside Postman/Newman | Newman executed: 37/37 requests, 18/18 assertions, 0 failed (`postman/newman-report.json`) | **PASS** |

### Render (Williams)

| Requirement | Evidence | Status |
|---|---|---|
| Real hosted service | Vultr VPS Paris, `https://199.247.9.188.nip.io` (Caddy + production LE cert); `/api/health` ok + remote flagship `completed` verified 2026-11-07 | **PASS** (Render prize itself not pursued — no Render usage) |
| Reliable background processing | No Render Workflows (prize not pursued); reconciliation/refund-status jobs run in-process on the hosted box, test-covered | **PASS** (non-Render) |
| Operational visibility | `GET /api/health` live at the public URL (systemd + journald on the box); no Render dashboard (prize not pursued) | **PASS** (non-Render) |
| Deployment reproducibility | `render.yaml` Blueprint + `.github/workflows/ci.yml` (test+build+flagship smoke) in repo | **PASS** (config) |

## Demo timestamp map (to fill when the video is cut)

| Video timestamp | Content | Status |
|---|---|---|
| TBD 0:00–0:20 | Problem + customer | **NOT DONE** — shot list ready in `docs/demo/DEMO_SCRIPT.md` |
| TBD 0:20–0:45 | Intent + Channel3 discovery (Acts 1–2) | **NOT DONE** — needs live Channel3 key for the "real search" shot |
| TBD 0:45–1:10 | Promise + approval + sandbox capture (Acts 3–4) | **NOT DONE** — needs sandbox creds for real IDs |
| TBD 1:10–1:40 | Incident + AI resolution + operator approval (Acts 5–6) | **NOT DONE** |
| TBD 1:40–2:10 | Real refund + verified result + negative scenario (Acts 7 + refusal) | **NOT DONE** |
| TBD 2:10–2:50 | Flight Recorder replay + Studio NL dashboard (Acts 8–9) | **NOT DONE** |

Total must stay under 3:00; judges need not watch more.
Video is the highest-impact remaining item (`docs/RELEASE_GATE.md`
gate 16); the hosted URL is done (gate 10, Vultr).
