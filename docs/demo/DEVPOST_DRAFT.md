# AFTERPACT — Devpost Draft (English, submission-ready pending URLs)

> Replace all `TBD:` markers before submitting. Nothing below claims a live
> URL, a recorded video, or verified sandbox IDs until those artifacts exist.

## Headline

**AFTERPACT — the assurance layer for agentic commerce: AI can buy anything,
we make sure the outcome matches the promise.**

## Inspiration

Shopping agents can already browse, compare, and check out. But a successful
payment is not a successful purchase: short deliveries, wrong items, missed
deadlines, and overcharges still land in a manual ops queue with no
machine-verifiable record of what was actually promised. We built the layer
that stands behind the purchase instead of stopping at checkout.

## What it does

AFTERPACT wraps every supported purchase in a verifiable lifecycle:

**Intent → Offer → Structured Promise → Approval → Payment → Outcome
Verification → Exception Detection → Authorized Resolution → Verified
Financial Result.**

Concretely: a buyer states a goal in natural language; the agent discovers
offers, freezes the chosen one into a versioned, hash-chained PurchasePromise
(merchant, total, items, delivery date, tolerances); the buyer approves that
exact promise; payment executes through PayPal Sandbox; delivery observations
are matched against the promise; mismatches raise incidents with cited
evidence; resolution proposals are validated against capture bounds and
policy; an authorized operator approves; the refund executes and is verified
at the provider before the case closes. The whole lifecycle replays in a
Flight Recorder: an append-only, hash-chained, redacted, exportable audit
trail. A strict policy engine (Cleared | Hold | Refused) gates every movement
of money, and prompt-injection attempts are blocked and preserved as evidence.

## How we built it

TypeScript throughout: a zero-dependency Node HTTP API (`apps/api`), a
static accessible web UI, and four packages — `domain` (money in integer
minor units, promises, approvals, 17-state lifecycle, audit chain),
`policy` (deterministic gates), `payments` (sandbox-only PayPal client:
OAuth caching, `PayPal-Request-Id` idempotency, webhook verification +
dedupe, kill switch), `ai` (Vultr Inference client with model-identity
verification, cost ledger, strict fallbacks). Money is exact; approvals
bind to a promise version + hash and expire; material changes invalidate
approval. Real runtime AI (intent interpretation, evidence-cited incident
analysis, gated recovery proposals — model proposes, policy + human
dispose), Channel3 discovery (live search artifact committed), AG Studio canvas + Agent Framework over live
data plus AG Grid Community analytics, a dependency-aware recovery
timeline, a Newman-verified 38-request Postman collection, and Vultr
hosting round out the build. 255 automated tests green (+33 keyless skips — live probes that skip
visibly without credentials), strict `tsc` clean on 6 projects,
6 Playwright E2E green. Every on-screen capability carries an origin badge (`REAL API`,
`PAYPAL SANDBOX · LIVE`, `SIMULATED · MOCK`, `AI · LIVE` / `AI · OFF`, …)
so judges can see exactly what is live and what is labeled simulation.

## Challenges we ran into

Drawing a hard line between discovery and payment (a Channel3 result never
implies we can charge that merchant); making idempotency replay-before-gate
so retries after completion replay instead of throwing; keeping every demo
path on the same Ops methods as the real routes (no parallel demo backend);
vendoring AG Grid reproducibly with hash verification; and resisting the
urge to overclaim sponsor usage: Bryntum and APIMatic stay filed
non-claims with upgrade paths, while AG Studio earned a genuine
integration (real canvas + Agent Framework, commercial EULA respected —
no bytes committed, official-CDN-first loading).

## Accomplishments we're proud of

- A complete 9-act flagship scenario (intent → verified partial refund →
  Studio regeneration) reproducible via one API call or the Demo view.
- Financial guardrails with teeth: replay-before-gate idempotency,
  concurrency serialization, kill switch, webhook replay/tamper rejection —
  all test-proven, with 5 real bugs found and fixed by the suite.
- Honest labeling end to end: nothing simulated can pass as live.

## What we learned

Successful HTTP responses are not successful financial outcomes; status
fields must be reconciled. Idempotency must be checked before state gates,
not after. And the fastest way to lose a judge's trust is an unlabeled mock —
so we badged everything.

## What's next

Install the AG Studio trial key and confirm judging-window coverage;
record the <3-min video; run a live Channel3 search on camera; pilot with
one merchant ops team on a single exception category; per-session demo
isolation; then a Bryntum evaluation if its trial permits judging use.

## Built With

TypeScript, Node.js, Zod, Vitest, Playwright, PayPal REST APIs (Orders
v2, Captures, Refunds, Webhooks — Sandbox), Vultr Inference
(deepseek-v4.1-flash-1017), Channel3, AG Studio + AG Grid Community,
Postman/Newman, Vultr (hosting), Caddy.

## Sponsor integrations (honest status)

- **Channel3:** live client implemented; calls the API when keyed, fails
  closed (HTTP 503) without a key — never fabricates results.
- **AG Grid:** AG Studio canvas + Agent Framework over live data (own LLM
  adapter, trial watermark until licensed) plus Community tables and strict
  NL queries.
- **Postman:** 38-request collection (auth, positive, idempotency, negatives).
- **Render:** not pursued (no payment card); `render.yaml` kept as a deployment-as-code reference only. Live demo runs on Vultr.
- **Bryntum / APIMatic:** not in this build; filed non-claims, prizes not pursued.

## AI tools used (how each was used)

- **Vultr Inference `deepseek-v4.1-flash-1017` (runtime):** interprets
  purchase intent, analyzes incidents against cited evidence, drafts
  recovery proposals, and drives the Studio agent — every output is
  schema-validated, policy-gated, and never self-executes payments.
- **Deterministic engine (runtime):** heuristic parser fallback, rule-based
  gap detection, exact-money policy gates (Cleared | Hold | Refused),
  hash-chained audit — authoritative over the model.
- **LLM coding assistance (authoring time):** implementation and docs were
  written with AI assistance; all claims above are backed by executed
  tests and committed evidence, not by the assistant's word.

## How to test

```bash
git clone https://github.com/toskaman/afterpact && cd afterpact
npm install && cp .env.example .env
npm run build && npm start   # http://localhost:3001
npm test                     # 255 passed, 33 skipped keyless (live paths need creds)
```

Run the flagship: `POST /api/demo/run {"scenario":"flagship"}` or open
`#/demo` → Flagship. Negative case: `{"scenario":"injection"}` (both
attacks `blocked` with exact policy reasons). Live paths unlock with
`PAYPAL_CLIENT_ID/SECRET` and `CHANNEL3_API_KEY` in `.env`.

- Demo video (<3 min): `TBD:youtube-url`
- Hosted demo: `https://199.247.9.188.nip.io` (Vultr VPS, mock transport — one-click flagship, no login needed; free through judging, Dec 15, 2026)
- Test credentials/notes: none needed for the hosted demo; live sandbox/Channel3 paths unlock with your own keys per `.env.example` (`docs/demo/KEY_RETRIEVAL_GUIDE.md`)
