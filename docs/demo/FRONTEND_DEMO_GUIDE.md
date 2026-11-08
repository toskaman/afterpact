# Frontend + Flight Recorder + Demo Mode — guide

Build: `apps/api` (HTTP API + static host) + `apps/web/public` (SPA with
AG Grid Community UMD vendored for Studio tables and AG Studio 3.1.0
loaded from the official CDN with a build-time local fallback). Tests:
`tests/integration/apps.api.test.ts` + `sponsors.*.test.ts` (API-driven)
plus 5 Playwright browser specs in `tests/e2e/` (CI `e2e` job, Chromium).

## Views

| Route | View | What it proves |
|---|---|---|
| `#/` | Command Center | Live exposure, captures, refunds, open incidents, resolution queue, recent Flight Recorder events |
| `#/copilot` | Purchase Copilot | NL request → heuristic parse → offer compare → promise → bound approval |
| `#/tx`, `#/tx/:id` | Transactions + Detail | Lifecycle state, policy verdict, PayPal order/capture actions, outcomes, refunds, per-promise history + redacted export |
| `#/recovery` | Recovery Center | Incident diagnosis, resolution proposals, approve/reject, verified execution |
| `#/studio` | Intelligence Studio | AG Studio canvas + AI agent over live rows (trial watermark until licensed), Community tables, KPI widgets, cross-filter, theming, NL command box |
| `#/discovery` | Discovery | Channel3 live search/comparison/lookup with attribution; honest unconfigured state without a key |
| `#/timeline` | Recovery Timeline | Dependency-aware schedule (fallback renderer, no Bryntum); incident shifts recomputed from state |
| `#/recorder` | Flight Recorder | Filterable hash-chained timeline, step replay, chain-validity badge, redacted export download |
| `#/developer` | Developer Center | API health, sandbox config (redacted), integration status, kill-switch test tool, endpoint reference |
| `#/demo` | Demo / Jury Mode | Reproducible flagship + injection scenarios, provenance legend, per-run reset (token-gated) + operator global reset, run cap |
| `#/ai-gallery` | AI Evidence Gallery | RECORDED VERIFIED AI RUNs: run totals, featured model outputs with latency/cost/citations/gate verdicts, reproduce recipe — no inference on the page |

## Jury script — “The Purchase That Went Wrong” (~3 min)

1. Open `#/demo`. Note the provenance legend and the transport pill in the
   top bar (`MOCK · SIMULATED` without PayPal credentials,
   `PAYPAL SANDBOX · LIVE` with them).
2. Run the flagship scenario. Acts 1–9 execute through the real API:
   heuristic intent parse → discovery (live Channel3 candidates when a key
   is configured, else simulated catalog — payment always routes to the
   authorized sandbox merchant) → exact-amount approval → order + capture
   (live sandbox pauses for real buyer approval at the PayPal URL; mock
   uses a labeled simulated buyer) → scripted short-delivery event →
   mismatch detection → partial-refund proposal ($129.99) validated
   against capture bounds → operator approval → provider refund → verified
   status → Flight Recorder chain check → Studio regeneration from live
   data (Act 9, `real-api`; AG Studio canvas regenerates from the same
   live datasets as the Community tables).
3. Click the promise ref into `#/tx/:id`: policy verdict, PayPal ids,
   evidence, and history are all real API reads.
4. Open `#/recorder?promiseId=…`, step the replay, download the redacted
   export (JSON attachment, secrets redacted, `chainValid` flag).
5. Run the injection scenario: merchant-swap and amount-increase attempts are
   both `blocked` with exact policy reason codes; filter the recorder by
   `policy.blocked` to show the preserved evidence.
6. Reset is offered only in mock mode; in live mode the button is disabled
   with the reason stated. Each run you start returns a reset token: “Reset
   this run” deletes only that run’s records (exact-id sweep, other
   visitors’ runs untouched, audit entries retained append-only). Global
   reset still needs the operator token on shared boxes. Runs are capped
   (`AFTERPACT_MAX_DEMO_RUNS`, default 50) with an explicit 429.

## Real vs simulated — labeling policy

Every demo act, payment response, and offer list carries an origin marker:
`REAL API`, `PAYPAL SANDBOX · LIVE`, `SIMULATED · MOCK`, `SIMULATED · BUYER`,
`SIMULATED · CATALOG`, `SIMULATED · LOGISTICS`, `HEURISTIC PARSE`,
`CHANNEL3 · LIVE` / `DISCOVERY UNAVAILABLE`, `AG GRID COMMUNITY` /
`NATIVE TABLE FALLBACK`, `COMPUTED SCHEDULE` / `FALLBACK TIMELINE`,
`NOT IN THIS BUILD`. The UI never renders unbadged simulated money;
unconfigured integrations (Channel3 without a key, AI without a key) render
no data at all, and the Studio canvas shows its trial watermark until
`AG_STUDIO_LICENSE_KEY` is set. Bryntum stays an explicitly labeled
`FALLBACK` next to the real fallback implementation.

## Accessibility (WCAG 2.2 AA where feasible)

Skip link, landmarks, semantic tables/lists, labeled inputs, visible focus,
`aria-current` nav, `aria-live` toasts and status, native `<dialog>`
confirms, keyboard-operable replay stepper, `prefers-reduced-motion` support,
text+icon status (never color-only), responsive down to 360px.

No third-party usability test was performed (single-session build); that is
the disclosed limitation.

## Honest limitations

- Runtime AI runs through Vultr Inference when `VULTR_INFERENCE_API_KEY` is
  set (intent interpretation, incident analysis, recovery proposals, Studio
  agent), with `ai-live` / `ai-off` origin pills everywhere and
  deterministic fallbacks + policy gates when it is not. The Copilot parse
  itself stays heuristic (`origin: heuristic-parse`); the Studio NL box is
  a strict filter language alongside the model-backed agent chat.
- The fallback offer catalog and logistics events are deterministic
  simulations, always badged; Channel3 live discovery replaces the catalog
  seed only when a key is configured (payment still routes to the
  authorized sandbox merchant).
- AG Studio is genuinely integrated (canvas + Agent Framework with our own
  model); the demo shows its trial watermark until a licence key is
  installed. Bryntum is an explicitly labeled fallback renderer with a
  documented upgrade path.
- Persistence is a JSON snapshot (`AFTERPACT_DATA_DIR`), not SQLite — the
  chain is still hash-verified on load and writes are atomic.
