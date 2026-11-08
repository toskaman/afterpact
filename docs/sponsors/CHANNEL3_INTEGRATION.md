# Channel3 live discovery (Engine B)

Date: 2026-11-07. Real HTTP integration: `POST /v1/search`,
`GET /v1/products/{id}`, `POST /v1/lookup` against
`https://api.trychannel3.com` with `x-api-key` auth.

## How to enable

1. Get a key at https://trychannel3.com (no credit card; use the
   `PAYPAL-HACKATHON-2026` promo only if legitimately available to you).
2. Set `CHANNEL3_API_KEY` in `.env` (never commit it).
   Optional: `CHANNEL3_API_BASE`, `CHANNEL3_COUNTRY` (default `US`),
   `CHANNEL3_CURRENCY` (default `USD`), `CHANNEL3_LANGUAGE` (default `en`),
   `CHANNEL3_TIMEOUT_MS` (default `15000`).
3. `GET /api/discovery/status` flips to `{"configured": true, "mode": "live"}`;
   `/api/config` `features.channel3` flips to `live`.

Without a key, discovery **fails closed**: status says `unconfigured`,
search/compare/lookup return HTTP 503 `discovery-unavailable`, the UI
disables the forms with the reason shown, and the flagship demo falls
back to the simulated catalog (Act 2 stays `mock-simulated`). No
availability, price, or candidate is ever fabricated.

## What the integration does

| Concern | Implementation |
|---|---|
| Live search | `Channel3Client.searchProducts` — NL query, limit, price-ceiling filter (minor→major conversion), default/agentic modes, locale config |
| Normalization | `normalizeProduct`/`normalizeOffer`: per-retailer merchant, price → minor units (currency-aware decimals), availability → `in_stock`/`out_of_stock`/`unknown`. Unparseable prices stay `null`; unrecognized availability stays `unknown` — never defaulted to in-stock |
| Comparison | `compareCandidates`: priced offers ranked **within each currency only**; unpriced offers listed separately, unranked; warnings for multi-currency, missing prices, unknown availability |
| Attribution | Every candidate carries `{source: channel3, productId, searchedAt, query, locale}` + a checkout disclaimer; the UI renders all of it |
| Failure isolation | Typed `Channel3Error` codes (`channel3-auth/-timeout/-network/-rate-limited/-provider/-rejected/-not-found/-bad-response`) with `retryable` flags; HTTP mapping 503 (no key) / 502 (provider); per-product isolation in compare (one 404 does not fail the batch); Act 2 catches provider failure and falls back without failing the demo |
| Audit | `discovery.search/compare/lookup` Flight Recorder events (query, counts, latency — no key material) |

## Checkout separation (anti-conflation rule)

Discovery results are **never** treated as checkout authorization. The
payment path accepts only the explicitly authorized sandbox merchant
offer (`demo-merchant-*`); a Channel3 hit cannot flow into
`POST /api/payments/orders` (merchant-unknown policy refusal). The UI
and every candidate attribution repeat this.

## Prize eligibility note

Channel3 requires actually CALLING the API or MCP server. This build
calls the live REST API whenever a key is configured (verify:
`discovery.search` audit events with `origin: channel3-live`, plus the
latency column). With no key configured at judging time, the call path
is real but unexecuted — set the key on the demo host (or a local `.env`)
to make the live path demoable. Live execution is NOT VERIFIED until a
keyed run commits its evidence (see manifest `channel3Live`).

## Files

- `apps/api/src/channel3.ts` — client, normalization, comparison
- `apps/api/src/ops.ts` — `discoveryStatus/searchDiscovery/compareDiscovery/lookupDiscovery` + audit
- `apps/api/src/routes.ts` — `/api/discovery/*`
- `apps/web/public/app.js` — `#/discovery` view
- `tests/integration/sponsors.discovery.test.ts` — stubbed-fetch + HTTP tests
- `.env.example` — `CHANNEL3_*` variables

## References

- Channel3 for Developers: https://trychannel3.com/developers
- API docs: https://docs.trychannel3.com
- Integration skill (request/response shapes): https://github.com/channel3-ai/skills (skills/channel3-api)
