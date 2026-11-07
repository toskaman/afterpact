# PayPal Integration (`@afterpact/payments`)

Server-side PayPal module: Orders v2 checkout, captures, full/partial
refunds, webhooks, and provider reconciliation. Sandbox only; live mode is
disabled by default and requires an explicit opt-in.

## Layout

| File | Responsibility |
|---|---|
| `config.ts` | Log-safe config, `fromEnv()`, sandbox/live guards |
| `transport.ts` | `PayPalTransport` interface + `HttpPayPalTransport` (OAuth, `PayPal-Request-Id`) |
| `mock.ts` | `MockPayPalTransport`: in-memory Orders v2, buyer-approval simulation, HMAC webhook signer |
| `service.ts` | `PayPalService`: kill switch, idempotency, locks, gates, audit |
| `store.ts` | `PaymentStore` records + per-key async mutexes |
| `webhooks.ts` | Signature verify → transmission-id dedupe → routed state sync |
| `reconcile.ts` | Forward-only local repair toward provider truth |
| `auditLog.ts` | Hash-chained, secret-free audit entries + structured logs |
| `redact.ts` | Secret classification/redaction (fail-closed) |
| `scopedTools.ts` | Pure AI propose-only tools (no provider imports, enforced by test) |
| `status.ts` / `wire.ts` / `errors.ts` | Status maps, Zod wire schemas, typed errors |

## Flows

- **Create order** → returns `providerOrderId` + buyer `approveUrl`.
  Local order id is sent as `custom_id` so captures link back on webhooks.
- **Buyer approves** at PayPal → `CHECKOUT.ORDER.APPROVED` webhook moves the
  local order `created → approved` (or poll `getOrderStatus(id, {refresh})`).
- **Capture** requires an approved local order plus, when supplied, a domain
  buyer `Approval` bound to the exact promise version + hash (expiry
  enforced via `assertApprovalUsable`).
- **Refunds** are partial (explicit amount) or full (amount omitted =
  remaining balance). Domain `validateRefundBounds` + policy `evaluateRefund`
  gate every request; lifetime refunds can never exceed the captured total.
- **Status reads** (`getOrderStatus` / `getRefundStatus`) accept
  `{refresh: true}` to re-read the provider and move local records forward.

## Safety properties

- **Kill switch** (`PAYPAL_KILL_SWITCH` / `setKillSwitch`): mutating ops
  throw `PayPalKillSwitchError`; reads, webhooks, and reconciliation stay
  open (they only move local state toward provider truth).
- **Idempotency**: every mutating call takes an idempotency key, sent as
  `PayPal-Request-Id`. Same key + same payload → stored result replayed
  (`duplicate: true`, `duplicate-skipped` operation recorded). Same key +
  different payload → `PayPalReplayError`.
- **Concurrency**: each op runs inside a per-record async mutex, so racing
  callers serialize; record + operation + audit updates land atomically.
  Failed provider calls leave failed-operation/audit traces and no partial
  records (verified by tests).
- **Webhooks**: transmission headers required → signature verified
  (verify-webhook-signature API on HTTP; HMAC on the mock) → dedupe on
  transmission id (same body → `duplicate`, different body →
  `PayPalWebhookReplayError`) → routed update. Unknown event types are
  recorded and ignored.
- **Reconciliation**: `reconcileOrder` / `reconcileRefund` diff local vs
  provider and repair local records forward-only; currency drift is
  reported, never auto-repaired.
- **Secrets**: config carries no secrets; every audit payload and log line
  passes through fail-closed redaction. Tests assert secrets never appear
  in entries or structured logs.
- **AI boundary**: agents receive only `proposeOrderCreation` /
  `proposeCapture` / `proposeRefund` (strict Zod, proposal + fingerprint,
  `executesProviderCall: false`). The module imports only `zod` + domain;
  a test fails the build if provider-capable imports appear.

## Configuration

See `.env.example`. Key rules enforced in code:

- `PAYPAL_MODE=sandbox` + `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`
  (exact match required).
- Live needs `PAYPAL_MODE=live` **and** `PAYPAL_ALLOW_LIVE=true`,
  otherwise `PayPalLiveDisabledError`.
- `PAYPAL_WEBHOOK_ID` is required for real signature verification.

## Tests

```bash
# Mocked provider: flows, negatives, webhooks, kill switch, redaction, HTTP stubs
node node_modules/vitest/vitest.mjs run tests/integration
# Live sandbox probe (create + get one $1 order, abandoned before approval):
# runs only with PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET set, else skips cleanly.
PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... node node_modules/vitest/vitest.mjs run tests/integration
```

Note (repo runs on an SMB share): invoke `node`/`vitest` from the `Z:`
drive-letter cwd via direct `node_modules/...` entry points, as above.

## Negative coverage (all in `tests/integration`)

Currency mismatch (capture + refund), expired buyer approval, over-refund
(local bound + provider bound), duplicate webhook, webhook replay with a
different body, tampered signature, idempotency replay with a different
payload, kill-switch refusal, provider-failure atomicity, concurrent
same-key capture/refund, unknown webhook event, HTTP 429/422/timeout
mapping, OAuth token caching.
