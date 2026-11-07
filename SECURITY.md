# Security Policy

## Scope

AFTERPACT moves real money semantics (PayPal Sandbox during the hackathon).
Financial safety is never weakened to accelerate development.

## Rules

- **Sandbox only**: `PAYPAL_MODE=sandbox` and `api-m.sandbox.paypal.com`.
  Production endpoints stay disabled in code and config.
- **No secrets in the repo**: credentials live in untracked `.env` only.
  `.env.example` carries placeholders, never values.
- **Exact money**: integer minor units end to end; no floating-point amounts
  in domain logic or persistence.
- **Defense in depth**: Zod validation at every trust boundary (API input,
  webhooks, AI output); deterministic policy engine before any payment;
  idempotency keys on all mutating payment operations; webhook dedupe on
  transmission id.
- **Auditability**: append-only, hash-chained Flight Recorder entries for
  every state transition and payment operation. No update/delete API exists
  for audit entries.
- **Dependencies**: permissive licenses only (MIT/ISC/Apache-2.0 compatible
  with the repo MIT license). Review `npm ls` output before adding a
  dependency with a reciprocal or proprietary license.

## Sponsor integrations

- **Channel3**: API key travels server-side only (`x-api-key` header from
  Node, never from the browser). The key is never logged, never returned
  by `/api/discovery/status` or `/api/config` (presence booleans only),
  and never recorded in Flight Recorder payloads. Timeouts + typed errors
  prevent discovery failures from affecting payments.
- **AG Grid Community**: vendored MIT bundle pinned by SHA-256
  (`scripts/vendor-ag-grid.mjs` verifies before/after copy). No CDN, no
  runtime download, no license key, no telemetry dependency.
- **Render**: secrets are `sync: false` Blueprint vars set in the
  dashboard; `PAYPAL_ALLOW_LIVE=false` is pinned in `render.yaml`.

## Reporting

Found a vulnerability? Please open a private report to the maintainers
instead of a public issue, and allow reasonable time for a fix before any
disclosure.
