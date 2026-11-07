# AFTERPACT Foundation Plan

- Date: 2026-11-07
- Goal: Stand up a minimal, credible, test-driven AFTERPACT foundation in 1 day:
  monorepo skeleton, domain core (promise + policy engine + state machine),
  PayPal sandbox client, SQLite persistence, Express API, Vite-React UI shell,
  Flight Recorder (hash-chained audit log), and CI-ready test suites — with
  NOTHING claimed that is not built and green.
- Architecture: minimal modular monolith. One Express API server + one static
  Vite-React client + SQLite file DB. Pure domain packages with zero framework
  imports so policy/state-machine logic is unit-testable without I/O.
- Tech Stack: TypeScript-first; Node 24 + Express 4 API; Vite 6 + React 19
  client; Zod 3 validation; Vitest 3 tests; better-sqlite3 persistence;
  plain CSS (no Tailwind — toolchain absent, keep it minimal). PayPal REST via
  undici fetch (no heavy SDK). Versions below are scaffold-day baselines to
  CONFIRM with `npm view <pkg> version` before pinning; pin exact versions in
  package.json when scaffolding.

## Architecture decision (record)

No toolchain exists in the workspace (verified 2026-11-07: no package.json,
no src/, no docs/, not a git repo; only prompt.txt). Per the minimal-credible
rule, we do NOT adopt Next.js App Router + Postgres + Prisma for the
foundation: too much scaffold weight for 5 days to deadline (Nov 12). Instead:
minimal Node + Express + Vite-React, SQLite (zero-ops, works on Render
free-tier and local dev), upgrade path to Postgres preserved behind a
repository interface. Sponsor SDKs (AG Studio, Channel3, Bryntum) land in
later plans behind adapters — this plan only creates the `sponsors/` seam.

## File structure (to create)

```text
afterpact/
  package.json                 # workspaces: apps/*, packages/*
  tsconfig.base.json
  vitest.workspace.ts
  .env.example                 # PAYPAL_CLIENT_ID/SECRET/MODE, DATABASE_URL, CHANNEL3_API_KEY, PORT
  .gitignore
  LICENSE                      # MIT (decided; OSI-approved, satisfies public-repo rule)
  README.md                    # quickstart + real-vs-simulated labeling policy
  apps/
    api/
      package.json
      tsconfig.json
      src/index.ts             # express app + listen
      src/routes/health.ts
      src/routes/intents.ts    # POST /v1/intents (Zod-validated)
      src/routes/promises.ts   # POST/GET /v1/promises, approvals
      src/routes/payments.ts   # order create/capture, refund (sandbox)
      src/routes/webhooks.ts   # PayPal webhook receiver + dedupe
      src/routes/audit.ts      # Flight Recorder read API
      src/db.ts                # sqlite open + migrate
      src/migrations/001_init.sql
    web/
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      src/main.tsx
      src/App.tsx              # lifecycle shell: intent form → promise card → status
      src/api.ts               # typed fetch client
      src/styles.css
  packages/
    domain/                    # ZERO deps except zod
      package.json
      src/intent.ts            # PurchaseIntent schema
      src/promise.ts           # PurchasePromise schema + canonical JSON + sha256
      src/lifecycle.ts         # state machine + transition table
      src/index.ts
    policy/                    # ZERO deps except zod + domain
      package.json
      src/engine.ts            # evaluate(): Cleared | Hold | Refused
      src/index.ts
    payments/                  # paypal client (undici/facade), no express
      package.json
      src/paypal.ts            # token, createOrder, captureOrder, refund, getRefund
      src/index.ts
    evidence/                  # Flight Recorder core
      package.json
      src/recorder.ts          # append-only hash-chained entries
      src/index.ts
  tests/
    unit/domain.test.ts
    unit/policy.test.ts
    unit/recorder.test.ts
    unit/lifecycle.test.ts
    integration/api.int.test.ts      # supertest vs express, sqlite :memory:
    integration/paypal.int.test.ts   # sandbox-gated (skip without creds)
  scripts/
    seed.ts
  docs/                        # audit docs already written (this plan adds none)
```

## TDD task list (bite-sized; RED → GREEN → REFACTOR each)

Conventions: run from repo root. Unit command: `npx vitest run tests/unit`.
API tests: `npx vitest run tests/integration/api.int.test.ts`.
Package deps pinned exact at scaffold; confirm latest with
`npm view <name> version` first. Baseline scaffold versions (verify, then pin):
typescript ~5.9, express ~4.21, vite ~6.x, react ~19.x, zod ~3.24,
vitest ~3.x, better-sqlite3 ~11/12, supertest + @types/* as needed.

### Task 0 — Scaffold skeleton (no TDD; enables all tasks)

1. `npm init -y`, set `"private": true`, `"type": "module"`,
   `"workspaces": ["apps/*", "packages/*"]`.
2. Add root devDeps: typescript, vitest (+ workspace file), tsx (dev runner).
3. Write tsconfig.base.json (strict, nodenext, noUncheckedIndexedAccess),
   per-package tsconfigs extending it, .gitignore, .env.example, LICENSE
   (MIT), README quickstart skeleton.
4. `git init` (workspace is not a repo yet), first commit "chore: scaffold".
5. Verify: `npx tsc -b` (or per-package `tsc --noEmit`) passes on empty src.

### Task 1 — Domain: PurchasePromise schema + integrity hash

- RED: create `tests/unit/domain.test.ts` asserting: (a) valid promise parses;
  (b) missing buyer/merchant/amount fails; (c) `canonicalize()` is key-sorted
  stable JSON; (d) `fingerprint()` is sha256 hex of canonical form and stable
  across key order.
- GREEN: implement `packages/domain/src/promise.ts` (Zod schema with fields:
  id, buyer, merchant, currency, maxAmountCents int>0, items[], quantities,
  expectedDeliveryDate, tolerances, evidenceRequirements, resolutionPolicy,
  approval {by, at} nullable, version int, hash string) + `intent.ts`
  (PurchaseIntent: rawText, budgetCents, currency, categories, quantity,
  deadline, merchantConstraints, riskTolerance, mandatory[]) + index exports.
- Commands: `npx vitest run tests/unit/domain.test.ts`; `npx tsc --noEmit -p packages/domain`.

### Task 2 — Domain: lifecycle state machine

- RED: extend `tests/unit/lifecycle.test.ts`: legal path
  DRAFT→OFFER_SELECTED→AWAITING_APPROVAL→APPROVED→PAYMENT_PENDING→
  PAYMENT_CAPTURED→OUTCOME_MONITORING→INCIDENT_DETECTED→RESOLUTION_PROPOSED→
  AWAITING_RESOLUTION_APPROVAL→RESOLUTION_IN_PROGRESS→RESOLUTION_VERIFIED
  passes; illegal jumps (DRAFT→PAYMENT_CAPTURED, APPROVED→RESOLUTION_VERIFIED)
  throw `InvalidTransition`; declined/expired/canceled/failed/escalated
  branches allowed from documented states.
- GREEN: implement `packages/domain/src/lifecycle.ts` as an explicit
  transition table + `transition(from, to)` guard; no linear-enum hacks.
- Commands: `npx vitest run tests/unit/lifecycle.test.ts`.

### Task 3 — Policy engine (deterministic, pure)

- RED: `tests/unit/policy.test.ts`: within-budget + allowed merchant →
  Cleared; over maxAmountCents → Refused; unknown merchant → Hold; expired
  promise → Refused; tampered hash (recompute mismatch) → Refused; amount
  increase vs approved version → Refused with reason code.
- GREEN: `packages/policy/src/engine.ts` `evaluate(promise, context)` →
  `{ verdict: 'Cleared'|'Hold'|'Refused', reasons: string[] }`; pure, no I/O,
  integer-cents only.
- Commands: `npx vitest run tests/unit/policy.test.ts`.

### Task 4 — Flight Recorder (hash-chained audit)

- RED: `tests/unit/recorder.test.ts`: append N entries → each entry stores
  prevHash + own sha256; `verifyChain()` true; tamper with entry k payload →
  `verifyChain()` false; entries append-only (no update/delete API exported).
- GREEN: `packages/evidence/src/recorder.ts` with `append(store, event)` /
  `verifyChain(entries)`; storage interface `AuditStore` (memory impl now,
  sqlite impl in Task 6).
- Commands: `npx vitest run tests/unit/recorder.test.ts`.

### Task 5 — PayPal sandbox client (real REST, no mocks in prod path)

- RED: `tests/integration/paypal.int.test.ts` (gated: `if (!process.env.PAYPAL_CLIENT_ID) it.skip`):
  getAccessToken → 200; createOrder($1.00 test) → id + approve link; getOrder
  round-trips. Refund/capture covered against sandbox in the payments plan
  (needs buyer approval); here assert client error mapping on 401/422 with a
  local stub ONLY for the error-shape test, clearly labeled stub (never
  presented as PayPal evidence).
- GREEN: `packages/payments/src/paypal.ts`: token cache with expiry,
  createOrder, showOrder, captureOrder, refundCapture, showRefund; all amounts
  as integer cents formatted to "1.00"; PayPal-Request-Id idempotency header
  on writes; typed errors {status, name, message}.
- Commands: `npx vitest run tests/integration/paypal.int.test.ts`
  (expect skips without creds; real run needs sandbox keys in untracked .env).

### Task 6 — SQLite persistence + migrations

- RED: `tests/integration/api.int.test.ts` setup creates `:memory:` DB via
  `apps/api/src/db.ts` `openDb(':memory:')` + migrate; assert tables
  (promises, audit_entries, payment_ops, webhook_events) exist.
- GREEN: `001_init.sql` with those tables (promises: id pk, canonical_json,
  hash, state, created_at; audit_entries: seq pk, prev_hash, hash, type,
  payload_json, created_at; payment_ops: idempotency_key unique, kind,
  paypal_id, status, amount_cents; webhook_events: transmission_id unique,
  type, payload_json, processed_at nullable); `db.ts` open/migrate/close.
- Commands: `npx vitest run tests/integration/api.int.test.ts -t db`.

### Task 7 — Express API: intents + promises + audit routes

- RED (supertest, :memory: DB): POST /v1/intents with valid body → 201 + id;
  invalid → 422 with Zod issues; POST /v1/promises → 201 + fingerprint;
  POST /v1/promises/:id/approve → state AWAITING_APPROVAL→APPROVED + recorder
  entry; illegal approve twice → 409; GET /v1/audit?promiseId → chained
  entries with verify=true.
- GREEN: routes + wiring in `apps/api/src/index.ts` (helmet-less minimal:
  express.json(), request-id, error middleware returning {error:{code,message}}).
  Every mutation appends a recorder entry and enforces `transition()`.
- Commands: `npx vitest run tests/integration/api.int.test.ts`; manual
  `npm run dev:api` + curl health check.

### Task 8 — Webhook receiver + dedupe

- RED: POST /v1/webhooks/paypal twice with same transmission id → second is
  200-duplicate without double-apply; unknown type → 200-ignored + logged;
  signature verification function unit-tested with a fixed HMAC-style vector
  (PayPal verify-signature call stubbed at the HTTP edge ONLY in tests).
- GREEN: `routes/webhooks.ts` storing raw event, dedupe on transmission id,
  dispatch table for PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED updating
  payment_ops + lifecycle to PAYMENT_CAPTURED / failed branches.
- Commands: `npx vitest run tests/integration/api.int.test.ts -t webhook`.

### Task 9 — Vite-React shell (lifecycle UI, no fake data)

- Implement (UI smoke, not TDD): IntentForm → POST /v1/intents; PromiseCard
  showing merchant/amount/state/fingerprint; AuditTimeline from GET /v1/audit.
  Empty states honest ("no promises yet"). `src/api.ts` typed client.
  Verify: `npm run dev` (concurrent api+web), manual click-through, and
  `npx tsc --noEmit -p apps/web`.
- No Tailwind, no charts, no sponsor widgets in this plan.

### Task 10 — CI gate + evidence hygiene

- Add `.github/workflows/ci.yml`: node 24, `npm ci`, `npx tsc -b`-equivalent,
  `npx vitest run tests/unit`, integration suite with :memory: DB (sandbox
  tests skip without secrets).
- Update README: quickstart, env table, test commands, real-vs-simulated
  labeling policy, honest limitations section.
- Update `docs/hackathon/JURY_EVIDENCE_MATRIX.md` rows built in this plan
  from TBD → file paths. Leave the rest TBD.
- Verify: full `npx vitest run` green (sandbox tests skipped, visibly).

## Out of scope for this plan (later plans)

AG Studio dashboards, Channel3 discovery, Bryntum timeline, Render Workflows,
Postman collection, Elastic retrieval, AI provider adapter (intent extraction
stays manual-structured in the foundation; model wiring is the next plan),
capture/refund end-to-end demo script, video.

## Self-review

- [ ] Every task names exact paths, exact commands, and pass criteria — no
  placeholders, no "implement later".
- [ ] TDD order respected: domain/policy/recorder (pure, fast) before
  I/O-bound API/DB work; PayPal tests gated, never faked.
- [ ] Minimal deps: express, zod, vitest, vite, react, better-sqlite3, tsx,
  supertest — each justified; no Next.js/Postgres/ORM/Tailwind weight.
- [ ] Security: integer cents, idempotency keys, webhook dedupe, hash-chained
  audit, Zod at every boundary, secrets only via untracked .env.
- [ ] Honesty: sandbox-gated tests skip visibly; stub usage confined to one
  labeled error-shape test; matrix rows flip to evidence only when built.
- [ ] Risk: better-sqlite3 native build on Windows/Render — mitigate by
  pinning a prebuilt version and testing `npm install` on a clean checkout
  first; fallback is node:sqlite (Node 24 built-in) with the same SQL.
