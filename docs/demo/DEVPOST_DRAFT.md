# AFTERPACT — Devpost Draft (English, submission-ready pending URLs)

> Replace all `TBD:` markers before submitting. Nothing below claims a live
> URL, a recorded video, or verified sandbox IDs until those artifacts exist.

## Project title

AFTERPACT — The Assurance Layer for Agentic Commerce

## Short tagline

AI can buy anything. AFTERPACT makes sure the outcome matches the promise.

## Inspiration

Shopping agents can already browse, compare, and check out. But a successful
payment is not a successful purchase: short deliveries, wrong items, missed
deadlines, and overcharges still land in a manual ops queue with no
machine-verifiable record of what was actually promised. Pre-purchase guards
say whether an agent *may* buy; nothing verifies what the buyer *received*.
We built the missing layer that stands behind the purchase instead of
stopping at checkout.

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

## How it works

1. **Promise.** The chosen offer freezes into a PurchasePromise pinned by
   version + hash; approvals bind to that exact version and expire.
2. **Pay.** PayPal Sandbox order → buyer approval → capture, with
   `PayPal-Request-Id` idempotency and webhook verification + dedupe.
3. **Verify.** Delivery observations are matched against the promise by a
   deterministic gap detector; mismatches become categorized incidents.
4. **Recover.** AI drafts an evidence-cited recovery proposal; the policy
   engine verdicts it; an authorized human approves; the bounded refund
   executes and is verified at the provider before closure.
5. **Prove.** Flight Recorder replays promise, events, decisions, and the
   provider receipt with chain validation; the Outcome Twin shows
   promised vs observed vs recovered on one screen.

## AI technology

Real runtime inference on Vultr Inference (`deepseek-v4.1-flash-1017`,
model identity verified per call, cost-ledgered): purchase-intent
interpretation, evidence-cited incident analysis, recovery-proposal
drafting, and the AG Studio agent's NL-to-widget turns. Every model output
is schema-validated; the deterministic policy engine + human approval stay
authoritative — the model proposes, policy + human dispose. 53-scenario
evaluation corpus incl. adversarial cases (4 keyed runs: 117/120, citation
precision 1.000 on the flagship run); the public demo ships a RECORDED
VERIFIED AI RUN gallery with real latency/cost, never labeled live.

## PayPal integration

Sandbox-native throughout: Orders v2 create + buyer approval + capture,
partial refunds bounded by remaining capture, webhook signature
verification with replay/tamper rejection, replay-before-gate idempotency
so retries after completion replay instead of double-executing, provider
status reconciliation before any case closes, and a kill switch. Real
sandbox loop committed as redacted evidence: order `2ER387580K033722V` →
capture `7R158417X9367771B` → partial refund `8DJ895035B173303G`
(`docs/demo/paypal-live-receipts.json`, test-pinned). No live-money code
paths exist.

## Sponsor integrations (honest status)

- **Channel3:** live client implemented; keyed search artifact committed
  (3 candidates, 1187 ms); fails closed (HTTP 503) without a key — never
  fabricates results. Discovery never authorizes checkout.
- **AG Grid:** AG Studio 3.1.0 canvas + Agent Framework over live data
  (own Vultr-backed LLM adapter, Signature theme matched to the app, trial
  watermark until licensed) plus AG Grid Community analytics and strict NL
  queries. Commercial EULA respected: no bytes committed,
  official-CDN-first loading with a pinned build-time fallback.
- **Postman:** 38-request collection (auth, positive, idempotency,
  negatives); Newman 37/37 executed, 18/18 assertions green.
- **Render:** not pursued (no payment card); `render.yaml` kept as a
  deployment-as-code reference only. Live demo runs on Vultr.
- **Bryntum / APIMatic / Elastic / KERNEL / Astropods / Zapier:** not in
  this build; filed non-claims, prizes not pursued.

## Technical architecture

TypeScript throughout: a zero-dependency Node HTTP API (`apps/api`), a
static accessible web UI, and four packages — `domain` (money in integer
minor units, promises, approvals, 17-state lifecycle, audit chain),
`policy` (deterministic gates), `payments` (sandbox-only PayPal client),
`ai` (Vultr Inference client with identity verification, cost ledger,
strict fallbacks). Single-node JSON snapshot store (documented
limitation; SQLite/PostgreSQL is future work). 280 automated tests green
(+33 keyless skips that skip visibly), strict `tsc` clean on 6 projects,
6 Playwright E2E green, CI `verify`+`e2e`+`drift` green at HEAD. Every
on-screen capability carries an origin badge (`REAL API`,
`PAYPAL SANDBOX · LIVE`, `SIMULATED · MOCK`, `AI · LIVE` / `AI · OFF`, …)
so judges see exactly what is live and what is labeled simulation.

## Challenges we ran into

Drawing a hard line between discovery and payment (a Channel3 result never
implies we can charge that merchant); making idempotency replay-before-gate
so retries after completion replay instead of throwing; keeping every demo
path on the same Ops methods as the real routes (no parallel demo backend);
respecting the AG Studio commercial EULA while keeping a reproducible
install (official-CDN-first + pinned fallback + Community tables); and
resisting overclaim: Bryntum, APIMatic and others stay filed non-claims.

## Accomplishments we're proud of

- A complete 9-act flagship scenario (intent → verified partial refund →
  Studio regeneration) reproducible via one API call or the Demo view.
- Financial guardrails with teeth: replay-before-gate idempotency,
  concurrency serialization, kill switch, webhook replay/tamper rejection —
  all test-proven, with 5 real bugs found and fixed by the suite.
- Honest labeling end to end: nothing simulated can pass as live.
- A docs-truth system: release evidence manifest + CI drift detector so no
  public claim can silently go stale.

## Lessons learned

Successful HTTP responses are not successful financial outcomes; status
fields must be reconciled. Idempotency must be checked before state gates,
not after. And the fastest way to lose a judge's trust is an unlabeled mock —
so we badged everything.

## Impact

Buyer: the Merchant Operations Manager who owns the exception queue (see
`docs/business/WHY_A_MERCHANT_WOULD_PAY.md`). Controlled self-test on one
real case shape: 8 estimated manual touchpoints (~28 min est.) collapse to
3 operator decisions with zero hand computations and seconds of machine
time — explicitly estimates, NOT measured human timings; the lab-study
package (`docs/benchmarks/USABILITY_STUDY.md`) is ready for independent
participants. Structural, test-proven wins stand today: over/duplicate
refunds refused at two bounds, hash-chained evidence bundles instead of
spreadsheet rows, deterministic injection blocking.

## Innovation

The dominant hackathon pattern is pre-payment authorization ("LLM
proposes, code decides, human approves, PayPal pays"). AFTERPACT owns the
lifecycle tail competitors omit: promise verification → exception →
authorized resolution → provider-verified result, for ordinary captured
(not held) PayPal payments. Full 13-stage mapping vs 15+ observed entries
in `docs/competition/WHY_AFTERPACT_IS_DIFFERENT.md` — no "world first"
claimed, only cited gaps.

## Commercial potential

Incident-volume pricing against the ops-labor and leakage budgets; pilot
wedge is one merchant account + one exception category with manual
approvals and read-only trial mode. Honest maturity bar: SQLite migration,
independent usability sessions, and SOC 2 stand between this build and
enterprise rollout. Details: `COMMERCIAL_STRATEGY.md`, `UNIT_ECONOMICS.md`
(all figures labeled assumed until a pilot measures them).

## Future roadmap

Install the AG Studio trial key and confirm judging-window coverage;
record the <3-min video; run a live Channel3 search on camera; pilot with
one merchant ops team on a single exception category; per-session demo
isolation; SQLite persistence; then a Bryntum evaluation if its trial
permits judging use.

## Built With

TypeScript, Node.js, Zod, Vitest, Playwright, PayPal REST APIs (Orders
v2, Captures, Refunds, Webhooks — Sandbox), Vultr Inference
(deepseek-v4.1-flash-1017), Channel3, AG Studio + AG Grid Community,
Postman/Newman, Vultr (hosting), Caddy.

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
npm test                     # 280 passed, 33 skipped keyless (live paths need creds)
```

Run the flagship: `POST /api/demo/run {"scenario":"flagship"}` or open
`#/demo` → Flagship. Negative case: `{"scenario":"injection"}` (both
attacks `blocked` with exact policy reasons). AI evidence without keys:
`#/ai-gallery` (RECORDED VERIFIED AI RUN). Live paths unlock with
`PAYPAL_CLIENT_ID/SECRET` and `CHANNEL3_API_KEY` in `.env`.

## Links

- GitHub: `https://github.com/toskaman/afterpact`
- Hosted demo: `https://199.247.9.188.nip.io` (Vultr VPS, mock transport — one-click flagship, no login needed; free through judging, Dec 15, 2026)
- Demo video (<3 min): `TBD:youtube-url`
- Test credentials/notes: none needed for the hosted demo; live sandbox/Channel3 paths unlock with your own keys per `.env.example` (`docs/demo/KEY_RETRIEVAL_GUIDE.md`)
