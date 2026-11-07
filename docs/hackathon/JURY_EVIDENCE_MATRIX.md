# AFTERPACT — Jury Evidence Matrix

Judge roster and prize/criteria facts verified on the Devpost page body +
rules §§6,8 (2026-11-07). Professional backgrounds from public bios as noted;
no personal preferences invented. Judges may change.

Status (2026-11-07): NOTHING below is built. Every row is TBD until the
mapped file/test/demo artifact exists. This matrix is the checklist that turns
green during implementation.

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
| Exceptional documentation | README.md, docs/architecture/* | TBD |
| Simple installation | README quickstart; `npm install && npm run dev` + `.env.example` | TBD |
| Clean SDK integrations | `packages/payments/*` PayPal client; Channel3/AG Studio wiring | TBD |
| Intuitive onboarding | README + demo script `docs/demo/SCRIPT.md` | TBD |
| Accessible design | App a11y pass (labels, focus, contrast) | TBD |
| Convincing DX | Typed errors, `packages/*` READMEs, Postman collection | TBD |
| Clear error messages | Error taxonomy + tests `tests/unit/errors.test.ts` | TBD |
| Reproducible examples | Postman collection + seed script `scripts/seed.ts` | TBD |

### Financial software engineering (Ravi, Singh, Richmond-background)

| Requirement | Evidence | Status |
|---|---|---|
| Real PayPal operations | Sandbox order→capture→refund with IDs in Flight Recorder | TBD |
| Idempotency | PayPal-Request-Id on writes; dedupe tests | TBD |
| Permission boundaries | Scoped server tools; AI cannot call PayPal directly | TBD |
| Transaction integrity | Integer cents; state-machine transition tests | TBD |
| Correct failure recovery | Webhook redelivery + reconciliation tests | TBD |
| Safe concurrency | Double-refund guard tests (dispute-before-refund check) | TBD |
| Comprehensive logging | Flight Recorder audit trail + redacted export | TBD |
| Automated tests | `npm run test:unit` green; integration suite vs sandbox | TBD |

### AI platform reliability (Ravi / Cosmos.AI lens)

| Requirement | Evidence | Status |
|---|---|---|
| Prompt-injection resistance | Negative demo scenario + adversarial tests | TBD |
| Structured validated AI outputs | Zod schemas on all model outputs; validation tests | TBD |
| Deterministic financial policies | Pure policy engine + unit tests (Cleared/Hold/Refused) | TBD |
| Refusal behavior | Policy refusal demo + Flight Recorder rejection entry | TBD |
| Controlled tool permissions | Tool manifest; AI proposes, code decides, human approves | TBD |
| Reproducible evaluations | Deterministic fixtures; scripted eval commands | TBD |
| Graceful degraded operation | Non-AI matcher fallback; sponsor-failure tolerance tests | TBD |

### Product management (Olson, Hassan, Bryntse)

| Requirement | Evidence | Status |
|---|---|---|
| Clear customer segment | Merchant ops teams / marketplaces (README + pitch) | TBD |
| Validated pain points | Problem statement grounded in competitor gaps (this repo: COMPETITIVE_LANDSCAPE.md) | TBD |
| Strong differentiation | Post-payment assurance vs pre-auth crowd (demo Act 5–8) | TBD |
| Quantifiable impact | Amounts-at-risk → verified-refund figures in Studio dashboard | TBD |
| Customer adoption pathway | Onboarding path for one ops-team persona | TBD |
| Credible commercialization | Business note `docs/business/MODEL.md` (hypotheses labeled as such) | TBD |

### AG Grid (Vargas)

| Requirement | Evidence | Status |
|---|---|---|
| Real AG Studio integration | Embedded Studio dashboards in app | TBD |
| Bespoke visualizations / custom widgets | Commerce Intelligence Studio views | TBD |
| Cross-filtering | Global filters wired across widgets | TBD |
| Interactive analytics | Drill-down on incidents/refunds/merchants | TBD |
| Studio Agent Framework | NL commands changing real dashboard state | TBD |
| NL dashboard manipulation | "Show incidents with unresolved refunds above $100" etc., live | TBD |

### APIMatic (Hassan, Olson)

| Requirement | Evidence | Status |
|---|---|---|
| Context Plugin actually used | Plugin in coding-agent setup | TBD |
| API contract correctness | Validated PayPal requests; schema corrections log | TBD |
| Traceable integration decisions | `docs/architecture/APIMATIC_EVIDENCE.md` | TBD |
| Robust API error handling | PayPal error-mapping tests | TBD |

### Bryntum (Bryntse)

| Requirement | Evidence | Status |
|---|---|---|
| Real dependency-aware scheduling | Recovery Operations Timeline (Gantt/Scheduler) | TBD |
| Timeline reorganization | Incident alters schedule dependencies, live | TBD |
| Operational deadlines | Evidence/merchant-response/refund milestones on timeline | TBD |
| Task updates from commercial events | Webhook/incident → task mutation wiring + test | TBD |

### Channel3 (Bicard)

| Requirement | Evidence | Status |
|---|---|---|
| Real product search requests | POST /v1/search calls with responses logged | TBD |
| Normalization + comparison | Normalized schema + ranking explanations in UI | TBD |
| Source transparency | Merchant/source attribution per offer | TBD |
| AI selection on real results | Agent pick traced to actual Channel3 payload | TBD |

### Elastic (Richmond)

| Requirement | Evidence | Status |
|---|---|---|
| Evidence search/retrieval | Only if built (P2): incident grounding search | TBD — likely cut |
| Grounded incident reasoning | Retrieval-backed resolution rationale | TBD — likely cut |
| Measured retrieval quality | Eval numbers if implemented | TBD — likely cut |

### Postman (Mistry)

| Requirement | Evidence | Status |
|---|---|---|
| Reproducible API collections | Exported collection in repo | TBD |
| Positive + negative scenarios | Auth/payment/refund happy path + failure cases | TBD |
| Idempotency + error tests | Replay + error-response cases in collection | TBD |
| Developer onboarding | Setup instructions in collection docs | TBD |

### Render (Williams)

| Requirement | Evidence | Status |
|---|---|---|
| Real hosted service | Live Render URL, free until Dec 15, 2026 | TBD |
| Reliable background processing | Render Workflows executions (reconciliation, refund-status checks) | TBD |
| Operational visibility | Render dashboard screenshots/links | TBD |
| Deployment reproducibility | `render.yaml` Blueprint in repo | TBD |

## Demo timestamp map (to fill when the video is cut)

| Video timestamp | Content | Status |
|---|---|---|
| TBD 0:00–0:20 | Problem + customer | TBD |
| TBD 0:20–0:45 | Intent + Channel3 discovery (Acts 1–2) | TBD |
| TBD 0:45–1:10 | Promise + approval + sandbox capture (Acts 3–4) | TBD |
| TBD 1:10–1:40 | Incident + AI resolution + operator approval (Acts 5–6) | TBD |
| TBD 1:40–2:10 | Real refund + verified result + negative scenario (Acts 7 + refusal) | TBD |
| TBD 2:10–2:50 | Flight Recorder replay + AG Studio NL dashboard (Acts 8–9) | TBD |

Total must stay under 3:00; judges need not watch more.
