# @afterpact/api — API server + web host

Zero-framework HTTP API (`node:http` only) plus static hosting for the
`@afterpact/web` console. Reuses the existing domain, policy, and payments
packages — no new dependencies.

## Run

```bash
# from the repo root (use the Z: drive path on Windows shares)
cd apps/api
npm run build   # tsc -> dist/
npm run start   # node dist/apps/api/src/index.js (PORT=3001 by default)
```

Open `http://localhost:3001/`. The same port serves the UI and `/api/*`.

For development with auto-rebuild: `npm run dev`.
Typecheck: `npm run typecheck`.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | Listen port |
| `AFTERPACT_DATA_DIR` | `./data` | JSON snapshot dir; `:memory:` disables persistence |
| `AFTERPACT_WEB_DIR` | auto | Override static dir (default resolves `apps/web/public`) |
| `AFTERPACT_MAX_AMOUNT_MINOR` | `100000` | Policy ceiling in minor units |
| `AFTERPACT_ALLOW_DEMO_RESET` | `1` | Set `0` to disable `/api/demo/reset` |
| `LOG_LEVEL` | `info` | `silent` quiets the payments log sink |
| `PAYPAL_*` | — | See `.env.example`. Live-sandbox transport activates only when `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` are present; otherwise the deterministic mock serves all payment calls and every response says so |
| `CHANNEL3_*` | — | See `.env.example`. Live discovery activates only when `CHANNEL3_API_KEY` is present; otherwise discovery reports `unconfigured` and searches return 503 (never fabricated) |

## API summary

- `GET /api/health`, `GET /api/config`, `GET /api/metrics`
- `POST /api/intents` (heuristic NL parse, labeled), `GET /api/intents[/ :id]`
- `GET /api/offers?intentId=` (simulated catalog, labeled)
- `POST /api/promises`, `GET /api/promises[?state=]`, `GET /api/promises/:id`
- `POST /api/promises/:id/approve|decline|change`
- `POST /api/payments/orders`, `GET /api/payments/orders/:id[?refresh=1]`
- `POST /api/payments/orders/:id/buyer-approve` (mock only), `.../capture`
- `POST /api/outcomes`, `GET /api/outcomes[?promiseId=]`
- `POST /api/incidents`, `GET /api/incidents[?status=]`
- `POST /api/resolutions`, `GET /api/resolutions`, `POST /api/resolutions/:id/decide`
- `GET /api/refunds/:id[?refresh=1]`, `POST /api/webhooks/paypal`
- `GET /api/audit[?promiseId=&type=&limit=]`, `GET /api/audit/export[?promiseId=]`
- `POST /api/admin/kill-switch` (mock mode only)
- `POST /api/demo/run {scenario: flagship|injection}`, `POST /api/demo/runs/:id/continue`, `GET /api/demo/runs[/ :id]`, `POST /api/demo/reset` (mock mode only)
- `GET /api/discovery/status`, `POST /api/discovery/search|compare|lookup` (Channel3 live when keyed, else 503)
- `GET /api/studio/datasets`, `POST /api/studio/command` (Commerce Intelligence Studio, real data)
- `GET /api/timeline?promiseId=` (dependency-aware recovery schedule)

Errors are `{error:{code,message,details}}` with `policy-blocked` carrying the
exact reason codes. Money is integer minor units on the wire, end to end.

## Notes

- The Flight Recorder chain is verified on every snapshot load; a broken
  persisted chain refuses to boot.
- Material changes on an approved promise reopen it to `AWAITING_APPROVAL`
  via an explicit audited `promise.reopened` event (forward-only lifecycle
  edges are never bypassed silently).
- The payments package keeps its own internal chain; the app-level chain is
  the durable Flight Recorder and records every payment outcome with provider
  ids + transport markers.
