# AFTERPACT — The Assurance Layer for Agentic Commerce

AI can buy anything. AFTERPACT makes sure the outcome matches the promise.

Built for the **PayPal AI Hackathon 2026**. AFTERPACT wraps agentic
purchases in a verifiable lifecycle: structured intent → discovered offer
→ versioned, hash-chained **PurchasePromise** → buyer approval →
PayPal Sandbox payment → outcome monitoring → incident detection →
AI-assisted resolution proposal → operator decision → verified refund.
Every step is guarded by a deterministic policy engine and recorded in
an append-only, hash-chained Flight Recorder.

> **Live demo:** `https://199.247.9.188.nip.io` (Vultr VPS, mock transport — deterministic one-click demo, no secrets on the box; live PayPal/Channel3 paths unlock with keys per `.env.example`)
> (see `docs/demo/VULTR_HOSTING.md`). Demo video (<3 min):
> built — `brag-output/paypal-ai-2026/AFTERPACT_PAYPAL_AI_FINAL.mp4`
> (165 s, 1080p30, EN subs; QA: `VIDEO_QA_REPORT.md`).
> Public YouTube URL: `TBD — owner uploads, then paste link here`.

## The problem

Shopping agents can already browse, compare, and check out. What they
cannot do is **stand behind the purchase**: when delivery is short,
wrong, late, or overcharged, there is no machine-verifiable record of
what was promised, no bound on what the agent may spend or concede, and
no auditable recovery. Merchants eat chargebacks; buyers lose trust.

## Differentiation

Most agentic-commerce demos stop at checkout. AFTERPACT starts where
they stop — the post-payment tail:

- **Promises, not carts.** Every purchase becomes a versioned,
  hash-chained commitment (merchant, total, items, delivery date).
  Material changes invalidate approval; approvals bind to an exact
  version + hash and expire.
- **Policy before money.** A deterministic engine (Cleared | Hold |
  Refused) with exact reason codes gates every payment and approval.
  Prompt-injection attempts are blocked and preserved as evidence.
- **Outcomes are verified, refunds are proven.** Delivery observations
  are matched against the promise; mismatches raise incidents; refund
  proposals are validated against capture bounds and verified at the
  provider before the case closes.
- **Flight Recorder.** The full lifecycle replays as a hash-chained,
  redacted, exportable audit trail — the artifact a merchant-ops team
  or a judge can actually inspect.
- **Sponsor-powered, honestly labeled.** Channel3 live discovery, AG Grid
  analytics, and a dependency-aware recovery timeline — each labeled
  with exactly what it is (see Real vs simulated).

## PayPal integration (central, sandbox)

PayPal Orders v2 + captures + refunds + webhooks are the only payment
path; there is no parallel mock checkout in production code paths. The
deterministic mock transport exists for tests and keyless demos, and
every response says which transport served it.

- `packages/payments/` — sandbox-only client: OAuth caching,
  `PayPal-Request-Id` idempotency, 429/422/timeout mapping, webhook
  verification + dedupe, kill switch (refuses new ops, keeps
  reads/webhooks/reconciliation open).
- Live mode is disabled in code: production requires explicit
  `PAYPAL_MODE=live` **and** `PAYPAL_ALLOW_LIVE=true` (default off).
- Full contract: `docs/payments/PAYPAL_INTEGRATION.md`.

## AI in this build (honest scope)

Real runtime inference (Vultr Inference, default model
`deepseek-v4.1-flash-1017`, identity verified on every call) proposes;
deterministic code + policy gates + human approval dispose. Without a
`VULTR_INFERENCE_API_KEY` every AI surface falls back honestly
(`AI · OFF` pill, heuristic/templated output labeled as such).

| Capability | Implementation | Label |
|---|---|---|
| Intent extraction | LLM interpretation (Zod-validated) → heuristic fallback | `ai-model:intent` / `heuristic-parse` |
| Offer ranking | Deterministic catalog scoring (+ live Channel3 when keyed) | `simulated-catalog` / `channel3-live` |
| Gap detection | Rule-based promise-vs-outcome matching | `real-api` |
| Incident analysis | LLM analysis with evidence citations, category-gated | `ai-model:incident` |
| Resolution drafting | LLM proposal, amount/policy-gated, never self-executing | `ai-model:recovery` |
| Studio agent | Real AG Studio Agent Framework + own Vultr adapter | `AI · LIVE` / `AI · OFF` |

Measured evidence: 30-scenario live eval `30/30` (citation precision
`1.000`, ~$0.0135/run) — see `docs/evals/README.md` and the verified
claims in `docs/hackathon/RELEASE_EVIDENCE_MANIFEST.json`. The Devpost
"AI tools used" section lists the model, the deterministic components,
and any LLM used at authoring time.

## Real vs simulated (labeling policy)

Anything a judge sees carries an origin marker. Summary:

| Origin | Meaning |
|---|---|
| `REAL API` | Computed from live local state (no provider call) |
| `PAYPAL SANDBOX · LIVE` | Real PayPal sandbox response (shows provider ids) |
| `SIMULATED · MOCK` | Deterministic payment mock (keyless runs) |
| `SIMULATED · CATALOG` / `SIMULATED · LOGISTICS` | Fallback catalog / scripted delivery events |
| `HEURISTIC PARSE` | Deterministic NL parsing (not an LLM) |
| `CHANNEL3 · LIVE` / `DISCOVERY UNAVAILABLE` | Live discovery vs unconfigured (no key → no data, HTTP 503) |
| `AG GRID COMMUNITY` / `NATIVE TABLE FALLBACK` | Real AG Grid tables; native fallback if the bundle is missing. The Studio canvas above them IS real AG Studio (trial watermark until licensed). |
| `COMPUTED SCHEDULE` / `FALLBACK TIMELINE` | Real schedule recomputation; **Bryntum is NOT claimed** |

Rules: credentials-needing tests **skip visibly** instead of faking a
pass; stubs exist only for error-shape tests and are named `*stub*`;
docs flip from TBD to evidence only when the artifact is built and green.

## Install

Prerequisites: Node 24+, npm 11+.

```bash
git clone https://github.com/toskaman/afterpact && cd afterpact
npm install
cp .env.example .env   # never commit .env
npm run build
npm start              # serves UI + API on http://localhost:3001
```

Optional keys in `.env` (each unlocks its live path; everything works
labeled without them):

- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` (+ `PAYPAL_WEBHOOK_ID`) —
  live sandbox payments instead of the mock transport.
- `CHANNEL3_API_KEY` — live product discovery instead of `unconfigured`.

## Test

```bash
npm run typecheck        # strict tsc over domain, policy, payments, ai, api, tests (6 projects)
npm run test:unit        # pure domain/policy unit tests (no creds, no network)
npm run test:integration # API + PayPal + sponsor suites (live-sandbox skips visibly without creds)
npm test                 # everything: 314 passed, 33 skipped keyless (2026-11-09; manifest-verified)
node --check apps/web/public/app.js
```

Clean-install check (Linux/CI with symlink-capable FS):

```bash
npm ci && npm run build && npm test
```

Note: this repo was assembled on an SMB share where npm workspace
symlinks fail (`ENOTSUP`); `npm ci` there is not representative — CI
runs on Ubuntu. See `docs/RELEASE_GATE.md`.

Postman: import `postman/AFTERPACT.postman_collection.json` (38
requests: auth helper, positive flows, idempotency replays, negatives,
exact error codes). Newman execution verified: 37/37 requests,
18/18 assertions (`postman/newman-report.json`).

Benchmarks: `node scripts/bench.mjs --base http://localhost:3001`
(see `docs/benchmarks/IMPACT_BENCHMARK.md`).

## Flagship repro (the 9-act demo)

Fastest (API):

```bash
curl -X POST http://localhost:3001/api/demo/run \
  -H 'content-type: application/json' \
  -d '{"scenario":"flagship","label":"jury"}'
# → {"data":{"status":"completed","acts":[…9 acts…],"context":{…}}}
```

In the UI: open `#/demo`, run **Flagship**, then click the promise ref
into `#/tx/:id`, replay `#/recorder?promiseId=…`, regenerate
`#/studio`, and inspect `#/timeline?promiseId=…`.

The 9 acts: intent → discovery → approval → payment → incident →
resolution → verified recovery → Flight Recorder → Studio
regeneration. With sandbox credentials, Act 4 pauses for real buyer
approval at the PayPal URL (`awaiting-action`; continue via
`POST /api/demo/runs/:id/continue`). Full narration + video shot list:
`docs/demo/DEMO_SCRIPT.md`.

Negative scenario: `{"scenario":"injection"}` — merchant-swap and
amount-increase attempts are both `blocked` with exact policy reasons.

## Proofs (where to look)

| Claim | Evidence |
|---|---|
| Promise integrity | `packages/domain/src/promise.ts` (hash chain), `tests/unit/promise.test.ts` |
| Policy gates money | `packages/policy/src/engine.ts`, `tests/unit/policy.test.ts` |
| Sandbox payments + refunds + webhooks | `packages/payments/src/`, `tests/integration/paypal.*.test.ts` |
| Lifecycle + idempotency | `packages/domain/src/{lifecycle,idempotency}.ts` |
| API + UI contract | `apps/api/src/`, `tests/integration/apps.api.test.ts` |
| Studio (real data + NL) | `apps/api/src/studio.ts`, `tests/integration/sponsors.studio.timeline.test.ts` |
| Channel3 live path | `apps/api/src/channel3.ts`, `tests/integration/sponsors.discovery.test.ts` |
| Recovery timeline | `apps/api/src/timeline.ts` |
| Deploy + CI | `render.yaml`, `.github/workflows/ci.yml` |
| Release status | `docs/RELEASE_GATE.md` (PASS/FAIL per gate, no inflated PASS) |

## Sponsors

| Sponsor | Status | Doc |
|---|---|---|
| AG Grid | **Studio canvas + Agent Framework used (trial watermark until licensed); Community tables kept** | `docs/sponsors/AG_GRID_STATUS.md` |
| Channel3 | **Live client; calls the API when keyed** | `docs/sponsors/CHANNEL3_INTEGRATION.md` |
| APIMatic | **Not used; explicitly not claimed** | `docs/sponsors/APIMATIC_EVIDENCE.md` |
| Bryntum | **Fallback timeline; Bryntum NOT claimed** | `docs/sponsors/BRYNTUM_STATUS.md` (+ `BRYNTUM_UPGRADE_PATH.md`) |
| Render | **Blueprint as reference only; live demo runs on Vultr (prize not pursued)** | `docs/sponsors/RENDER_DEPLOYMENT.md` |
| Postman | Collection shipped (no cash prize; evidence only) | `postman/` |

## Limitations (disclosed)

- Runtime AI (Vultr Inference, identity-verified) for intent/incident/
  recovery/Studio-agent tasks when keyed, with deterministic fallbacks and
  policy gates; see `docs/evals/README.md` for measured evidence.
- Fallback catalog/logistics are simulations (badged); live discovery
  needs a Channel3 key.
- Live-sandbox flagship verified 2026-11-07 (order `2ER387580K033722V`
  → capture `7R158417X9367771B` → partial refund `8DJ895035B173303G`
  `succeeded`, Flight Recorder VALID); CI skips the live path visibly
  without credentials.
- Persistence is a JSON snapshot, not SQLite; Render disk is 1 GB.
- Bryntum / APIMatic / Render Workflows are not in this build; upgrade
  paths are documented, prizes not claimed. AG Studio IS integrated
  (commercial trial bundle vendored with its license file).
- No third-party usability test (single build session).

## License

MIT — see [LICENSE](LICENSE), including the AG Studio commercial
carve-out. Runtime dependency: `zod` (MIT).
Frontend: AG Grid Community 36.3.0 is vendored (MIT,
`apps/web/public/vendor/ag-grid-community.LICENSE.txt`).
AG Studio 3.1.0 (Commercial trial,
`apps/web/public/vendor/ag-studio.LICENSE.html`) is NOT vendored: the
browser loads the SHA-pinned bytes from the official AG Grid CDN first,
with a build-time-fetched local copy (`npm run vendor:ag-studio`,
gitignored) as fallback — full license needed for production use beyond
evaluation. Portions of this software are copyright 2015-2026 by AG Grid Ltd.
