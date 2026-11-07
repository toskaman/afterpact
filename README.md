# AFTERPACT — The Assurance Layer for Agentic Commerce

AI can buy anything. AFTERPACT makes sure the outcome matches the promise.

Built for the **PayPal AI Hackathon 2026**. AFTERPACT wraps agentic
purchases in a verifiable lifecycle: structured intent → discovered offer
→ versioned, hash-chained **PurchasePromise** → buyer approval →
PayPal Sandbox payment → outcome monitoring → incident detection →
AI-assisted resolution proposal → operator decision → verified refund.
Every step is guarded by a deterministic policy engine and recorded in
an append-only, hash-chained Flight Recorder.

> **Live demo:** `TBD — paste the Render URL here after deploy`
> (see `docs/sponsors/RENDER_DEPLOYMENT.md`). Demo video (<3 min):
> `TBD — paste the YouTube link here`.

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

| Capability | Implementation | Label |
|---|---|---|
| Intent extraction | Deterministic heuristic parser (budget, qty, deadline, constraints) | `heuristic-parse` |
| Offer ranking | Deterministic catalog scoring | `simulated-catalog` |
| Gap detection | Rule-based promise-vs-outcome matching | `real-api` |
| Resolution drafting | Templated proposals from incident category + capture bounds | `real-api` |
| Studio NL commands | Strict filter language (`incidents unresolved refunds >$100`) | `real-api` |

**No LLM inference runs in this build.** The Devpost "AI tools used"
section must list these deterministic components as such, plus any LLM
used at authoring time by the team. Nothing on screen claims model
inference.

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
| `AG GRID COMMUNITY` / `NATIVE TABLE FALLBACK` | Real AG Grid tables; native fallback if the bundle is missing. **AG Studio is NOT claimed** |
| `COMPUTED SCHEDULE` / `FALLBACK TIMELINE` | Real schedule recomputation; **Bryntum is NOT claimed** |

Rules: credentials-needing tests **skip visibly** instead of faking a
pass; stubs exist only for error-shape tests and are named `*stub*`;
docs flip from TBD to evidence only when the artifact is built and green.

## Install

Prerequisites: Node 24+, npm 11+.

```bash
git clone <this-repo> && cd afterpact
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
npm run typecheck        # strict tsc over domain, policy, payments, api, tests
npm run test:unit        # pure domain/policy unit tests (no creds, no network)
npm run test:integration # API + PayPal + sponsor suites (live-sandbox skips visibly without creds)
npm test                 # everything: 155 passed, 1 skipped (2026-11-07)
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
exact error codes).

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
| AG Grid | **Community tables used; AG Studio NOT claimed** | `docs/sponsors/AG_GRID_STATUS.md` (+ `AG_STUDIO_UPGRADE_PATH.md`) |
| Channel3 | **Live client; calls the API when keyed** | `docs/sponsors/CHANNEL3_INTEGRATION.md` |
| APIMatic | **Not used; explicitly not claimed** | `docs/sponsors/APIMATIC_EVIDENCE.md` |
| Bryntum | **Fallback timeline; Bryntum NOT claimed** | `docs/sponsors/BRYNTUM_STATUS.md` (+ `BRYNTUM_UPGRADE_PATH.md`) |
| Render | **Blueprint + CI; deploy is a human step** | `docs/sponsors/RENDER_DEPLOYMENT.md` |
| Postman | Collection shipped (no cash prize; evidence only) | `postman/` |

## Limitations (disclosed)

- No LLM inference in the build; AI surfaces are deterministic and labeled.
- Fallback catalog/logistics are simulations (badged); live discovery
  needs a Channel3 key.
- Live-sandbox flagship path is implemented but unverified without
  credentials in CI (skips visibly; verify manually before the video).
- Persistence is a JSON snapshot, not SQLite; Render disk is 1 GB.
- AG Studio / Bryntum / APIMatic / Render Workflows are not in this
  build; upgrade paths are documented, prizes not claimed.
- No third-party usability test (single build session).

## License

MIT — see [LICENSE](LICENSE). Runtime dependency: `zod` (MIT).
Vendored frontend: AG Grid Community 36.3.0 (MIT,
`apps/web/public/vendor/ag-grid-community.LICENSE.txt`).
